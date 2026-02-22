"use client";

import { useState } from "react";
import api from "@/utils/api";
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
      const response = await api.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
        params: { action: "login", email, password },
      });

      const data = response.data;

      if (data.token) {
        localStorage.setItem("userToken", data.token);
        localStorage.setItem("userInfo", JSON.stringify(data.user));
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300 p-4">
      <Spinner isLoading={loading} message="Authenticating..." />

      <div className="w-full max-w-md">
        {/* Logo/Brand Area */}
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1.5 bg-teal-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-full mb-4">
            Meal App System
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
            Sign In<span className="text-teal-500">.</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Enter your credentials to access your portal
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 transition-all"
        >
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-3 rounded-xl mb-6 text-xs font-bold border border-rose-100 dark:border-rose-800 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="mb-5">
            <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-500 outline-none transition-all text-sm font-bold text-gray-900 dark:text-white"
              required
            />
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Password
              </label>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-500 outline-none transition-all text-sm font-bold text-gray-900 dark:text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full p-3.5 rounded-xl text-white font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-[0.98] ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-teal-600 hover:bg-teal-700 shadow-teal-500/20"
            }`}
          >
            {loading ? "Verifying..." : "Access Dashboard"}
          </button>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-tight">
              Secure AES-256 Encrypted Connection
            </p>
          </div>
        </form>

        <p className="text-center mt-8 text-xs text-gray-500 dark:text-gray-500">
          Forgot password? Please contact your{" "}
          <span className="font-bold text-teal-600">System Admin</span>.
        </p>
      </div>
    </div>
  );
}
