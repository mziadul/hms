import React from "react";

interface SpinnerProps {
  isLoading: boolean;
  message?: string;
}

export default function Spinner({
  isLoading,
  message = "Loading...",
}: SpinnerProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative flex items-center justify-center">
        {/* Outer Ring */}
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
      {message && (
        <p className="mt-4 text-lg font-semibold text-white animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
