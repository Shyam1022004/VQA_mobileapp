import React, { useState, useEffect, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ChatBubble from "../components/ChatBubble";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([
    { text: "Hello! Ask me anything using your voice or camera.", user: false },
  ]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [audioUri, setAudioUri] = useState("");

  const recordingRef = useRef(null);

  // ----------------------------------------------------------
  // Request mic permission
  // ----------------------------------------------------------
  useEffect(() => {
    (async () => {
      const mic = await Audio.requestPermissionsAsync();
      const cam = await ImagePicker.requestCameraPermissionsAsync();

      if (mic.status !== "granted") {
        Alert.alert("Microphone Required", "Enable microphone permission.");
      }
    })();
  }, []);

  // ----------------------------------------------------------
  // Start Recording (FIXED)
  // ----------------------------------------------------------
  const startRecording = async () => {
    try {
      if (Platform.OS !== "web") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
      }

      const recording = new Audio.Recording();

      await recording.prepareToRecordAsync(
        Platform.OS === "web"
          ? {}
          : {
              android: {
                extension: ".m4a",
                outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                audioEncoder: Audio.AndroidAudioEncoder.AAC,
              },
              ios: {
                extension: ".m4a",
                audioQuality: Audio.IOSAudioQuality.MAX,
                outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
              },
            }
      );

      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);

      console.log("🎙️ Recording started");
    } catch (error) {
      console.log("Start recording error:", error);
    }
  };


  // ----------------------------------------------------------
  // Stop Recording + Send to Flask Whisper Backend (FIXED)
  // ----------------------------------------------------------
  const stopRecording = async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      console.log("🛑 Recording stopped. File saved:", uri);

      if (!uri) {
        Alert.alert("Recording Error", "Audio file not captured.");
        return;
      }

      setAudioUri(uri);  // 🔥 VERY IMPORTANT
      setIsRecording(false);
      recordingRef.current = null;

      const transcript = await uploadToWhisper(uri);

      if (transcript) {
        const cleaned = preprocessText(transcript);
        console.log("📝 Preprocessed text:", cleaned);

        setInputText(cleaned);
        setMessages((prev) => [...prev, { text: cleaned, user: true }]);
      } else {
        console.log("❌ Transcription failed");
      }
    } catch (err) {
      console.log("Stop recording error:", err);
    }
  };

  // ----------------------------------------------------------
  const preprocessText = (text) => {
    if (!text) return "";

    // Step 1: Lowercase everything
    text = text.toLowerCase();

    // Step 2: Fix common OCR/typing mistakes
    const corrections = {
      "@": "a",
      "0": "o",
      "1": "i",
      "3": "e",
      "5": "s",
      "$": "s",
    };

    Object.keys(corrections).forEach((wrong) => {
      const correct = corrections[wrong];
      text = text.split(wrong).join(correct);
    });

    // Step 3: Remove unwanted characters
    text = text.replace(/[^a-z0-9\s?!.,]/g, "");

    // Step 4: Replace multiple punctuation with a single one
    text = text.replace(/[?!.,]{2,}/g, (m) => m[0]);

    // Step 5: Remove extra spaces
    text = text.replace(/\s+/g, " ").trim();

    return text;
  };


  // ----------------------------------------------------------
  // Upload audio → Flask Whisper backend (FIXED)
  // ----------------------------------------------------------
  const uploadToWhisper = async (uri) => {
    try {
      const data = new FormData();

      data.append("audio", {
        uri: uri,              // 🔥 USE uri argument, not audioUri
        name: "audio.m4a",
        type: "audio/m4a"
      });

      const response = await fetch("http://10.16.0.221:5001/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data"
        },
        body: data,
      });

      const json = await response.json();

      return json.preprocessed_text;

    } catch (err) {
      console.log("uploadToWhisper error:", err);
      return null;
    }
  };


  // ----------------------------------------------------------
  // Send message manually (text input)
  // ----------------------------------------------------------
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userText = inputText;
    setMessages((prev) => [...prev, { text: userText, user: true }]);
    setInputText("");

    setBotTyping(true);

    const processed = await sendTypedQuestion(userText);

    if (processed) {
      setMessages((prev) => [
        ...prev,
        { text: processed, user: false },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { text: "❌ Could not process your question", user: false },
      ]);
    }

    setBotTyping(false);
  };


  const sendTypedQuestion = async (text) => {
    try {
      const response = await fetch("http://10.16.0.221:5001/process-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const json = await response.json();
      return json.preprocessed_text;

    } catch (e) {
      console.log("sendTypedQuestion Error:", e);
      return null;
    }
  };


  // ----------------------------------------------------------
  // Camera
  // ----------------------------------------------------------
  const openCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // pick only images
        quality: 1,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri; // get image URI

        // Show captured message
        setMessages(prev => [
          ...prev,
          { text: "📷 Image captured!", user: true },
        ]);

        // Prepare FormData to send to Flask backend
        const data = new FormData();
        data.append("image", {
          uri: imageUri,
          name: "photo.jpg",
          type: "image/jpeg",
        });

        const response = await fetch("http://10.16.0.221:5001/process-image", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
          body: data,
        });

        const json = await response.json();
        console.log("Image API response:", json);

        // Optionally, show feature vector length
        if (json.image_features) {
          setMessages(prev => [
            ...prev,
            { text: `✅ Image features extracted (${json.image_features.length} dims)`, user: false },
          ]);
        }

      } else {
        console.log("Camera cancelled");
      }
    } catch (err) {
      console.log("openCamera error:", err);
    }
  };


  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------
  return (
    <LinearGradient
      colors={["#f0eefbff", "#4835a8ff"]}
      style={{ flex: 1, paddingTop: 50, paddingHorizontal: 16 }}
      className="absolute inset-0"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <Text style={{ fontSize: 36, fontWeight: "bold", color: "black" }}>
            Voice VQA
          </Text>
          <Text style={{ fontSize: 16, color: "black", marginTop: 4 }}>
            Ask questions using voice + image
          </Text>
        </View>

        {/* Chat List */}
        <ScrollView
          style={{ flex: 1, marginBottom: 50 }}
          contentContainerStyle={{ paddingBottom: 10 }}
        >
          {messages.map((msg, index) => (
            <ChatBubble key={index} message={msg.text} isUser={msg.user} />
          ))}

          {botTyping && (
            <View
              style={{
                backgroundColor: "#51de19ff",
                padding: 12,
                borderRadius: 16,
                alignSelf: "flex-start",
                marginVertical: 4,
              }}
            >
              <Text style={{ color: "#fff", fontStyle: "italic" }}>Typing...</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#171816",
            borderRadius: 30,
            paddingHorizontal: 16,
            paddingVertical: 15,
            marginHorizontal: 16,
            marginBottom: 50,
          }}
        >
          <TextInput
            style={{ flex: 1, color: "#fff", paddingHorizontal: 12 }}
            placeholder="Type Your Qs..."
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
          />

          <TouchableOpacity onPress={openCamera} style={{ marginHorizontal: 6 }}>
            <Ionicons name="camera" size={28} color="#fff" />
          </TouchableOpacity>


          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={{
              marginHorizontal: 6,
              backgroundColor: isRecording ? "red" : "#444",
              borderRadius: 20,
              padding: 6,
            }}
          >
            <Ionicons name="mic" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={sendMessage} style={{ marginHorizontal: 6 }}>
            <Ionicons name="send" size={28} color="#4ade80" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
