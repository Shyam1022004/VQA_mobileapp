import os
import re
import torch
import whisper
from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
from transformers import BertTokenizer, ViTModel, ViTFeatureExtractor
from PIL import Image
from io import BytesIO

# Fix ffmpeg path for Mac M1/M2/M3
os.environ["PATH"] += os.pathsep + "/opt/homebrew/bin"

app = Flask(__name__)
CORS(app)

# ------------------------------
# Load SentenceTransformer for text embeddings
# ------------------------------
text_embedder = SentenceTransformer("all-MiniLM-L6-v2")

def get_text_embeddings(text):
    return text_embedder.encode(text).tolist()

# ------------------------------
# Load Whisper for voice transcription
# ------------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
whisper_model = whisper.load_model("tiny", device=device)

# ------------------------------
# Load BERT tokenizer
# ------------------------------
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

# ------------------------------
# Load ViT for image feature extraction
# ------------------------------
vit_model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")
vit_model.eval()
vit_feature_extractor = ViTFeatureExtractor.from_pretrained("google/vit-base-patch16-224-in21k")

# ------------------------------
# Text preprocessing
# ------------------------------
def preprocess_text(text):
    if not text:
        return ""

    text = text.lower()
    corrections = {"@": "a", "0": "o", "1": "i", "3": "e", "5": "s", "$": "s"}
    for wrong, correct in corrections.items():
        text = text.replace(wrong, correct)

    text = re.sub(r"[^a-z0-9\s?!.,]", "", text)
    text = re.sub(r"[?!.,]{2,}", lambda m: m.group(0)[0], text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# ------------------------------
# Text API
# ------------------------------
@app.route("/process-text", methods=["POST"])
def process_text():
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400

    raw_text = data["text"]
    cleaned = preprocess_text(raw_text)
    embeddings = get_text_embeddings(cleaned)

    encoding = tokenizer.encode_plus(
        cleaned,
        add_special_tokens=True,
        return_tensors=None,
        return_attention_mask=True
    )
    input_ids = encoding["input_ids"]
    attention_mask = encoding["attention_mask"]

    return jsonify({
        "preprocessed_text": cleaned,
        "embeddings": embeddings,
        "input_ids": input_ids,
        "attention_mask": attention_mask
    })

# ------------------------------
# Voice transcription API
# ------------------------------
@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    filename = audio_file.filename or "audio.m4a"
    ext = filename.split(".")[-1]
    path = f"temp_audio.{ext}"
    audio_file.save(path)

    try:
        result = whisper_model.transcribe(path)
        raw_text = result.get("text", "").strip()
        cleaned = preprocess_text(raw_text)
        embeddings = get_text_embeddings(cleaned)

        return jsonify({
            "preprocessed_text": cleaned,
            "embeddings": embeddings
        })
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

# ------------------------------
# Image preprocessing and feature extraction API
# ------------------------------
@app.route("/process-image", methods=["POST"])
def process_image():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    img_file = request.files["image"]
    try:
        # Load image
        image = Image.open(img_file).convert("RGB")

        # Preprocess image for ViT
        inputs = vit_feature_extractor(images=image, return_tensors="pt")
        with torch.no_grad():
            outputs = vit_model(**inputs)
        
        # Extract CLS token as image feature vector
        image_features = outputs.last_hidden_state[:, 0, :].squeeze().tolist()

        return jsonify({
            "image_features": image_features
        })
    except Exception as e:
        print("Image processing error:", e)
        return jsonify({"error": str(e)}), 500

# ------------------------------
# Root
# ------------------------------
@app.route("/", methods=["GET"])
def home():
    return "VQA Backend Running"

# ------------------------------
# Run Flask
# ------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)