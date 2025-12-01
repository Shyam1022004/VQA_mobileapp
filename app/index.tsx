import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput,KeyboardAvoidingView,Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ChatBubble from "../components/ChatBubble";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from '@react-navigation/native';
import Voice from "react-native-voice"
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([
    { text: "Hello! Ask me anything.", user: false },
  ]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [botTyping, setBotTyping] = useState(false);

  // Camera function
  const openCamera = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      setMessages([...messages, { text: "Image captured!", user: true }]);
    }
  };

  // Voice function
  const startVoice = async () => {
    try {
      setIsRecording(true);
      await Voice.start("en-US");
    } catch (e) {
      console.log(e);
    }
  };

  const stopVoice = async () => {
    try {
      await Voice.stop();
      setIsRecording(false);
    } catch (e) {
      console.log(e);
    }
  };

  const sendMessage = () => {
    if (!inputText) return;
    setMessages([...messages, { text: inputText, user: true }]);
    setInputText("");
    // Simulate bot response
    setBotTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { text: "This is a bot response.", user: false },
      ]);
      setBotTyping(false);
    }, 1000);
  };

  return (
    <LinearGradient
      colors={["#f0eefbff", "#4835a8ff"]}
      style={{ flex: 1, paddingTop: 50, paddingHorizontal: 16 }}
      className="absolute inset-0"
    >
     <KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  className="flex-1"
  keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
>
  {/* your entire screen content */}
</KeyboardAvoidingView> 
      {/* Header */}
      <View style={{ alignItems: "center", marginBottom: 20 }} >
        <Text style={{ fontSize: 36, fontWeight: "bold", color: "black" }}>
          Voice VQA
        </Text>
        <Text style={{ fontSize: 16, color: "black", marginTop: 4 }}>
          Ask questions using voice and image
        </Text>
      </View>

      {/* Chat Scroll */}
      <ScrollView
        style={{ flex: 1, marginBottom: 16 }}
        contentContainerStyle={{ paddingBottom: 16 }}
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

      {/* Input Bar */}
      <View
        style={{
         flexDirection: "row",
         alignItems: "center",
         backgroundColor: "#171816",
         borderRadius: 30,
         paddingHorizontal: 16,
         paddingVertical: 15,
         paddingBottom: insets.bottom,   // Perfect on every Android device
         marginHorizontal: 16,
         marginBottom: 50,
        }}
      >
        <TextInput
          style={{ flex: 1, color: "#fff", paddingHorizontal: 12 }}
          placeholder="Type your question..."
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity onPress={openCamera} style={{ marginHorizontal: 6 }}>
          <Ionicons name="camera" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={isRecording ? stopVoice : startVoice}
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
    </LinearGradient>
  );
}