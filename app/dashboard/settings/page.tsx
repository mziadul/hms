"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";

interface SettingItem {
  key: string;
  value: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // ইনিশিয়াল ডাটা লোড এবং অথরাইজেশন চেক
  useEffect(() => {
    const info = localStorage.getItem("userInfo");
    const token = localStorage.getItem("userToken");

    if (!token || !info) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(info);
    setUserRole(userData.type); // 'admin' অথবা 'user'
    fetchSettings();
  }, [router]);

  // ডাটা ফেচ করার ফাংশন
  const fetchSettings = async () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    try {
      const res = await api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: { action: "getSettings", token },
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  // ডাটা সেভ করার ফাংশন
  const handleSave = async () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    try {
      // CORS এরর এড়াতে text/plain এবং JSON.stringify ব্যবহার করা হয়েছে
      await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=updateSettings&token=${token}`,
        JSON.stringify(items),
        { headers: { 'Content-Type': 'text/plain' } }
      );
      setIsEditing(false);
      await fetchSettings();
      alert("Settings saved successfully!");
    } catch (err) {
      alert("Error saving settings");
    } finally {
      setLoading(false);
    }
  }

  // বাংলাদেশি ফোন নাম্বার ভ্যালিডেশন (০১ দিয়ে শুরু এবং ১১ ডিজিট)
  const isValidBDPhone = (num: string) => {
    const cleanNum = num.replace(/[\s-]/g, ""); 
    return /^(\+8801|8801|01)\d{9}$/.test(cleanNum);
  };

  const handleInputChange = (idx: number, field: keyof SettingItem, value: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      <Spinner isLoading={loading} message="Syncing References..." />

      <div className="flex justify-between items-center mb-6 border-b-4 border-black dark:border-purple-500 pb-2">
        <h1 className="text-xl font-black uppercase tracking-tight">
          Reference Settings
        </h1>
        {userRole === "admin" && (
          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 bg-black text-white dark:bg-purple-600 font-black uppercase text-xs active:scale-95 transition-transform"
              >
                Edit Info
              </button>
            ) : (
              <>
                <button
                  onClick={() => setItems([...items, { key: "", value: "" }])}
                  className="px-4 py-2 bg-green-600 text-white font-black uppercase text-xs"
                >
                  + Add New
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-purple-600 text-white font-black uppercase text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Save
                </button>
                <button
                  onClick={() => { setIsEditing(false); fetchSettings(); }}
                  className="px-4 py-2 border-2 border-gray-400 font-black uppercase text-xs"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)]">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 dark:bg-gray-800 border-b-2 border-black font-black uppercase text-[10px] tracking-widest">
            <tr>
              <th className="px-6 py-4 border-r border-black/10">Label / Name</th>
              <th className="px-6 py-4">Reference Value / Number</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {items.map((item, idx) => (
              <tr key={idx} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                <td className="px-6 py-4 border-r border-black/10">
                  {isEditing ? (
                    <input
                      type="text"
                      placeholder="e.g. Internet Account"
                      value={item.key}
                      onChange={(e) => handleInputChange(idx, "key", e.target.value)}
                      className="w-full bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-2 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  ) : (
                    <span className="font-bold opacity-70 uppercase text-xs">{item.key}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    {isEditing ? (
                      <input
                        type="text"
                        placeholder="e.g. 017XXXXXXXX"
                        value={item.value}
                        onChange={(e) => handleInputChange(idx, "value", e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-2 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                      />
                    ) : (
                      <>
                        <span className="text-blue-600 dark:text-purple-400 font-black text-sm font-mono tracking-wider">
                          {item.value}
                        </span>
                        {/* কল বাটন - শুধুমাত্র ফোন নাম্বারের জন্য */}
                        {isValidBDPhone(item.value) && (
                          <a 
                            href={`tel:${item.value}`}
                            className="bg-green-500 hover:bg-green-600 text-white w-9 h-9 rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-90 transition-all text-lg"
                            title="Call this number"
                          >
                            📞
                          </a>
                        )}
                      </>
                    )}
                    {isEditing && (
                      <button
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="text-red-500 font-black hover:scale-120 transition-transform text-xl px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {items.length === 0 && !loading && (
          <div className="p-12 text-center font-bold text-gray-400 italic bg-white dark:bg-gray-900">
            No important information saved yet.
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 text-[10px] uppercase font-bold opacity-60">
        Note: Only Admin can update these records. Users can click on phone numbers to call directly.
      </div>
    </div>
  );
}