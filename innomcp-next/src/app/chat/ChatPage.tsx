"use client";

import React, { useState, useEffect } from "react";
import HeaderChat from "../components/HeaderChat";

// Define the type for a chat message
interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

const ChatPage: React.FC = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001/api/wsurlstats");

    ws.onopen = () => {
      console.log("WebSocket connection established with Node.js server");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, { sender: "ai", text: message.text }]);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (socket && input.trim() !== "") {
      const message: ChatMessage = { sender: "user", text: input };
      socket.send(JSON.stringify(message));
      setMessages([...messages, message]);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <HeaderChat />
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-2 rounded mb-2 ${
              msg.sender === "user" ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-300">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="border p-2 w-full"
          placeholder="Type your message..."
        />
        <button onClick={sendMessage} className="mt-2 p-2 bg-blue-500 text-white rounded">
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
