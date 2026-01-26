"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(
        process.env.NEXT_PUBLIC_GAS_URL!,
        null, // POST Body empty because we use query params
        { params: { action: "login", email, password } }
      );

      const data = response.data;

      if (data.token) {
        // ১. টোকেন সেভ করা
        localStorage.setItem("userToken", data.token);
        
        // ২. ইউজারের অতিরিক্ত তথ্য সেভ করা (যা আমরা স্ক্রিপ্টে অ্যাড করেছি)
        localStorage.setItem("userInfo", JSON.stringify(data.user));

        // ড্যাশবোর্ডে পাঠানো
        router.push("/dashboard");
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError("Server connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner isLoading={loading} message="Processing Request..." />
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-gray-200"
      >
        <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-600">
          Sign In
        </h1>
        
        {error && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block mb-1 text-sm font-semibold text-gray-700">Email Address</label>
          <input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block mb-1 text-sm font-semibold text-gray-700">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full p-2.5 rounded text-white font-bold transition-colors ${
            loading ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-md"
          }`}
        >
          {loading ? "Authenticating..." : "Login"}
        </button>
      </form>
    </div>
  );
}