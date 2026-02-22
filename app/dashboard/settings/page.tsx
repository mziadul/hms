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

  useEffect(() => {
    const info = localStorage.getItem("userInfo");
    const token = localStorage.getItem("userToken");

    if (!token || !info) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(info);
    setUserRole(userData.type);
    fetchSettings();
  }, [router]);

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

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    try {
      await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=updateSettings&token=${token}`,
        JSON.stringify(items),
        { headers: { "Content-Type": "text/plain" } },
      );
      setIsEditing(false);
      await fetchSettings();
      alert("✅ Settings saved successfully!");
    } catch (err) {
      alert("❌ Error saving settings");
    } finally {
      setLoading(false);
    }
  };

  const isValidBDPhone = (num: string) => {
    const cleanNum = num.replace(/[\s-]/g, "");
    return /^(\+8801|8801|01|09)\d{9}$/.test(cleanNum);
  };

  const handleInputChange = (
    idx: number,
    field: keyof SettingItem,
    value: string,
  ) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Spinner isLoading={loading} message="Syncing References..." />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight border-l-4 border-teal-500 pl-3">
            Reference Settings
          </h1>
          <p className="text-xs opacity-60 mt-1">
            Manage important numbers and mess credentials
          </p>
        </div>

        {/* BUTTON GROUP PILL CONTAINER */}
        {userRole === "admin" && (
          <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-inner w-full md:w-auto">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full md:w-auto px-6 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold text-xs uppercase rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 hover:border-teal-500 transition-all"
              >
                Edit Mode
              </button>
            ) : (
              <>
                <button
                  onClick={() => setItems([...items, { key: "", value: "" }])}
                  className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-emerald-700 transition-all"
                >
                  + Add New
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-blue-700 transition-all"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    fetchSettings();
                  }}
                  className="flex-1 md:flex-none px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold uppercase text-[10px] rounded-lg transition-all"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase tracking-widest font-black opacity-70">
                <th className="p-5 w-1/3">Label / Name</th>
                <th className="p-5">Reference Value / Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group"
                >
                  <td className="p-5 align-top">
                    {isEditing ? (
                      <input
                        type="text"
                        placeholder="e.g. Internet Account"
                        value={item.key}
                        onChange={(e) =>
                          handleInputChange(idx, "key", e.target.value)
                        }
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold transition-all"
                      />
                    ) : (
                      <span className="font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                        {item.key}
                      </span>
                    )}
                  </td>
                  <td className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      {isEditing ? (
                        <input
                          type="text"
                          placeholder="e.g. 017XXXXXXXX"
                          value={item.value}
                          onChange={(e) =>
                            handleInputChange(idx, "value", e.target.value)
                          }
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-black font-mono transition-all"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-gray-900 dark:text-gray-100 font-black text-sm font-mono tracking-wider">
                            {item.value}
                          </span>
                          {isValidBDPhone(item.value) && (
                            <a
                              href={`tel:${item.value}`}
                              className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Call this number"
                            >
                              <span className="text-sm">📞</span>
                            </a>
                          )}
                        </div>
                      )}
                      {isEditing && (
                        <button
                          onClick={() =>
                            setItems(items.filter((_, i) => i !== idx))
                          }
                          className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm ml-2"
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
            <div className="p-16 text-center text-gray-400 font-bold italic tracking-widest">
              No important information saved yet.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-500 rounded-r-lg">
        <p className="text-[10px] uppercase font-black text-blue-600 dark:text-blue-400 tracking-widest">
          Admin Notice
        </p>
        <p className="text-xs mt-1 opacity-70">
          Only Admin can update these records. Users can click on phone numbers
          to call directly.
        </p>
      </div>
    </div>
  );
}
