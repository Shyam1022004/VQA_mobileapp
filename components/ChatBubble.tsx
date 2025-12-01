import React from "react";
import { View, Text } from "react-native";

interface Props {
  message: string;
  isUser?: boolean;
}

export default function ChatBubble({ message, isUser = false }: Props) {
  return (
    <View className={`my-2 px-4 py-3 rounded-2xl max-w-[80%] ${isUser ? 'bg-green-600 self-end' : 'bg-gray-800 self-start'}`}>
      <Text className="text-white">{message}</Text>
    </View>
  );
}
