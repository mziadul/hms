"use client";

import { useEffect, useState } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      router.replace("/login");
      return;
    }
    setIsAuthorized(true);
  }, [router]);

  const handleUpdate = async () => {
    const token = localStorage.getItem("userToken");

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("data", JSON.stringify({ newPassword }));

      const res = await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=updateSelfPassword&token=${token}`,
        formData
      );

      if (res.data.success) {
        alert("Sync complete! Password updated.");
        setNewPassword("");
        setConfirmPassword("");
        router.push("/dashboard");
      } else if (res.data.error?.toLowerCase().includes("token")) {
        // Silent redirect if token expired
        localStorage.removeItem("userToken");
        localStorage.removeItem("userInfo");
        router.replace("/login");
      } else {
        alert(res.data.error || "Update failed.");
      }
    } catch (err) {
      alert("Save failed. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return <Spinner isLoading={true} message="Verifying session..." />;
  }

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      <Spinner isLoading={loading} message="Syncing with server..." />

      <div className="flex justify-between items-center mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
        <h1 className="text-2xl font-bold uppercase tracking-wider">
          Security Settings
        </h1>

        <div className="flex gap-3">
          <button
            onClick={handleUpdate}
            className="px-6 py-2 bg-blue-600 border-2 border-blue-700 text-white font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all"
          >
            Save New Password
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 font-black uppercase text-xs"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto mt-10 p-8 border-2 border-gray-300 dark:border-gray-700 rounded-xl shadow-md bg-gray-50 dark:bg-gray-800/50">
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-2">
              New Password
            </label>
            <input
              type="password"
              className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 px-4 py-3 rounded outline-none focus:border-blue-500 text-gray-900 dark:text-white font-bold"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 px-4 py-3 rounded outline-none focus:border-blue-500 text-gray-900 dark:text-white font-bold"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-500 text-sm text-yellow-800 dark:text-yellow-200">
          <p className="font-bold uppercase mb-1">Notice:</p>
          Updating your password will sync across all devices. You may be required to log in again on other sessions.
        </div>
      </div>
    </div>
  );
}