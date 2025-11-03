"use client";

import React, { useState, useEffect, useRef, useContext } from "react";
import Image from "next/image";
import HeaderChat from "../components/HeaderChat";
import ThemeContext from "../context/ThemeContext";
import { AiOutlinePlus } from "react-icons/ai";

// Define the type for a chat message
interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

const ChatPage: React.FC = () => {
  const { theme } = useContext(ThemeContext) as { theme: string };
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        const imageUrl = URL.createObjectURL(file);
        setSelectedImage(imageUrl);
      } else {
        setSelectedImage(null);
      }
    }
  };

  // ลบ unused drag/drop handler

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
  };

  return (
  <div className={`flex flex-col items-center overflow-hidden`}>
      <HeaderChat />
      <div className="flex flex-col flex-1 w-full items-center mt-4">
        <div className="w-full max-w-3xl bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-lg p-4 flex-shrink-0">
          <div className="flex flex-col gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-gray-700 p-3 text-base bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none w-full focus:border-indigo-500 focus:ring-0 min-h-[12] max-h-[32]"
              placeholder="Type your message..."
            />
            {selectedImage && (
              <div className="relative w-fit mt-2">
                <Image src={selectedImage} alt="preview" width={160} height={96} className="max-w-[10rem] max-h-24 rounded-lg border object-contain" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow hover:bg-red-600"
                  title="ลบรูป"
                >
                  &times;
                </button>
              </div>
            )}
            <div className="flex gap-4 mt-2 justify-between">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-200 rounded-lg px-6 py-2 font-semibold shadow flex items-center gap-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
              >
                <AiOutlinePlus />
              </button>
              <button
                onClick={sendMessage}
                className="bg-gradient-to-r from-indigo-500 to-blue-400 text-white rounded-lg px-6 py-2 font-semibold shadow hover:from-blue-400 hover:to-indigo-500 transition-colors"
              >
                Send
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
