"use client";

import React, { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

interface ToasterProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toaster({
  message,
  type,
  isVisible,
  onClose,
  duration = 3000,
}: ToasterProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  if (!isVisible) return null;

  const bgColors = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
  };

  return (
    <div className="fixed top-5 right-5 z-[10000] animate-bounce-in">
      <div
        className={`${bgColors[type]} flex items-center gap-3 px-6 py-3 rounded-lg shadow-2xl text-white transition-all transform hover:scale-105`}
      >
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-4 text-white/80 hover:text-white font-bold text-xl leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
