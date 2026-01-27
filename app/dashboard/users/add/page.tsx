"use client";

import { useState } from "react";
import api from "@/utils/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toaster, { type ToastType } from "@/components/Toaster";
import Spinner from "@/components/Spinner";

export default function AddUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    email: "",
    password: "",
    type: "",
    updatedBy: "",
  });

  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    isVisible: boolean;
  }>({ message: "", type: "success", isVisible: false });

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, isVisible: true });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("userToken");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await api.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
        params: {
          action: "addUser", // Matches GAS script
          token,
          ...form,
        },
      });

      if (res.data?.success) {
        showToast(res.data.success, "success");
        setForm({ id: "", name: "", email: "", password: "", type: "", updatedBy: "" });
      } else {
        showToast(res.data?.error || "Failed to add user.", "error");
      }
    } catch (err) {
      showToast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <Spinner isLoading={loading} message="Creating user account..." />
      <Toaster 
        {...toast} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />

      <h1 className="text-2xl font-bold mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
        Member Management
      </h1>

      <div className="max-w-2xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 dark:bg-gray-800 p-6 md:p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Member ID</label>
              <input
                type="text"
                name="id"
                value={form.id}
                onChange={handleChange}
                placeholder="e.g. 101"
                className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Full Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Email Address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="john@example.com"
                className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Secure Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Account Type</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              >
                <option value="">Select Role</option>
                <option value="admin">Administrator</option>
                <option value="user">Regular User</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Authorized By</label>
              <input
                type="text"
                name="updatedBy"
                value={form.updatedBy}
                onChange={handleChange}
                placeholder="Admin Name"
                className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase py-3 rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 mt-4"
          >
            Create Member Account
          </button>
        </form>

        <div className="mt-8 flex justify-center gap-6">
          <Link href="/dashboard/users" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to Member List
          </Link>
        </div>
      </div>
    </div>
  );
}