"use client";

import { useEffect } from "react";
import { FaCheck, FaTimes } from "react-icons/fa";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <FaCheck className="text-green-500" />;
      case "error":
        return <FaTimes className="text-red-500" />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 p-4 rounded-lg border shadow-lg z-50 flex items-center gap-2 ${getBgColor()}`}
    >
      {getIcon()}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-gray-400 hover:text-gray-600"
      >
        <FaTimes size={12} />
      </button>
    </div>
  );
}
