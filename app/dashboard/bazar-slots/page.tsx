"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
}

interface DateRangeItem {
  id?: string;
  userId: string;
  year: number;
  month: number;
  startDate: number;
  endDate: number;
}

export default function DateRangesPage() {
  const router = useRouter();
  const now = new Date();
  const [members, setMembers] = useState<Member[]>([]);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<DateRangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Initial Auth & Member Load
  useEffect(() => {
    const info = localStorage.getItem("userInfo");
    const token = localStorage.getItem("userToken");

    if (!token || !info) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(info);
    setUserRole(userData.type);

    setLoading(true);
    api
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: { action: "getUsers", token },
      })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setMembers(res.data);
        }
      })
      .catch(() => alert("Failed to load members"))
      .finally(() => setLoading(false));
  }, [router]);

  const isAdmin = userRole === "admin";

  // FIX 1: Reset functionality - No auto-assigning names.
  // It will create empty slots for Admin to choose.
  const handleAutoCalculate = () => {
    const eligible = members.filter((m) => m.name.toLowerCase() !== "omar");
    if (eligible.length === 0)
      return alert("Member list is empty. Please wait or refresh.");

    const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
    const numMembers = eligible.length;
    const baseDays = Math.floor(daysInMonth / numMembers);
    const remainder = daysInMonth % numMembers;

    let currentDay = 1;
    const newSlots = eligible.map((_, i) => {
      // Using '_' because we don't want to auto-assign
      const hasExtraDay = i >= numMembers - remainder;
      const duration = baseDays + (hasExtraDay ? 1 : 0);
      const slot = {
        userId: "", // DEFAULT EMPTY for Admin
        year: filterYear,
        month: filterMonth,
        startDate: currentDay,
        endDate: currentDay + duration - 1,
      };
      currentDay += duration;
      return slot;
    });

    setItems(newSlots);
    setIsEditing(true);
  };

  // FIX 2: Wrapped in useCallback to ensure stability and better sync
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    setLoading(true);
    try {
      const res = await api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: {
          action: "getBazarSlots",
          token,
          year: filterYear,
          month: filterMonth,
        },
      });

      const existingData = Array.isArray(res.data) ? res.data : [];

      setItems(
        existingData.map((d) => ({
          id: d.id,
          userId: String(d.userId || ""),
          year: filterYear,
          month: filterMonth,
          startDate: Number(d.startDate),
          endDate: Number(d.endDate),
        })),
      );

      setHasSearched(true);
      setIsEditing(false);
    } catch (err) {
      alert("Error fetching slots. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth]);

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append(
        "data",
        JSON.stringify({
          items: items,
          activeIds: items.map((i) => i.id).filter(Boolean),
        }),
      );

      await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=upsertDateRanges&token=${token}&year=${filterYear}&month=${filterMonth}`,
        params,
      );

      await fetchData();
      alert("Changes saved successfully!");
    } catch (err) {
      alert("Error saving data");
      setLoading(false);
    }
  };

  const handleInputChange = (
    idx: number,
    field: keyof DateRangeItem,
    value: any,
  ) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      <Spinner isLoading={loading} message="Syncing Slots..." />

      <h1 className="text-2xl font-black uppercase mb-6 border-b-4 border-black dark:border-purple-500 inline-block">
        Bazar Slot Manager
      </h1>

      <div className="flex flex-wrap items-end gap-4 mb-8 p-6 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase mb-1">
              Year
            </label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="bg-white dark:bg-gray-900 border-2 border-black px-3 py-2 font-bold outline-none text-gray-900 dark:text-white"
            >
              {[2026, 2025, 2024].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase mb-1">
              Month
            </label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="bg-white dark:bg-gray-900 border-2 border-black px-3 py-2 font-bold outline-none text-gray-900 dark:text-white"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Intl.DateTimeFormat("en-US", { month: "long" }).format(
                    new Date(2000, i, 1),
                  )}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchData}
            className="px-6 py-2.5 bg-black text-white font-black uppercase text-xs active:scale-95 transition-transform"
          >
            Load Existing
          </button>
          {isAdmin && (
            <button
              onClick={handleAutoCalculate}
              className="px-6 py-2.5 bg-blue-600 text-white font-black uppercase text-xs border-2 border-black"
            >
              Reset & Auto-Generate
            </button>
          )}
        </div>

        <div className="flex gap-2 ml-auto">
          {!isEditing ? (
            <button
              disabled={!hasSearched || loading}
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 border-2 border-black dark:border-gray-500 font-black uppercase text-xs dark:text-white"
            >
              {isAdmin ? "Edit Ranges" : "Claim My Slot"}
            </button>
          ) : (
            <>
              {isAdmin && (
                <button
                  onClick={() =>
                    setItems([
                      ...items,
                      {
                        userId: "",
                        year: filterYear,
                        month: filterMonth,
                        startDate: 1,
                        endDate: 1,
                      },
                    ])
                  }
                  className="px-4 py-2 bg-green-600 text-white font-black uppercase text-xs"
                >
                  + Add Slot
                </button>
              )}
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-purple-600 text-white font-black uppercase text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  fetchData();
                }}
                className="px-4 py-2 border-2 border-gray-400 font-black uppercase text-xs"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {hasSearched && (
        <div className="overflow-x-auto border-2 border-black dark:border-gray-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-200 dark:bg-gray-800 border-b-2 border-black font-black uppercase">
              <tr>
                <th className="px-6 py-4 border-r border-black/10">
                  Start Day
                </th>
                <th className="px-6 py-4 border-r border-black/10">End Day</th>
                <th className="px-6 py-4">Assigned Member</th>
                {isAdmin && isEditing && (
                  <th className="px-6 py-4 text-center">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {items.map((item, idx) => (
                <tr key={idx} className="bg-white dark:bg-gray-900">
                  <td className="px-6 py-4 border-r border-black/10">
                    {isEditing && isAdmin ? (
                      <input
                        type="number"
                        value={item.startDate}
                        onChange={(e) =>
                          handleInputChange(
                            idx,
                            "startDate",
                            Number(e.target.value),
                          )
                        }
                        className="w-20 bg-white dark:bg-gray-800 border-2 border-black p-1 font-bold text-gray-900 dark:text-white"
                      />
                    ) : (
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.startDate}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 border-r border-black/10">
                    {isEditing && isAdmin ? (
                      <input
                        type="number"
                        value={item.endDate}
                        onChange={(e) =>
                          handleInputChange(
                            idx,
                            "endDate",
                            Number(e.target.value),
                          )
                        }
                        className="w-20 bg-white dark:bg-gray-800 border-2 border-black p-1 font-bold text-gray-900 dark:text-white"
                      />
                    ) : (
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.endDate}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={item.userId}
                        onChange={(e) =>
                          handleInputChange(idx, "userId", e.target.value)
                        }
                        className="w-full bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 p-2 font-bold rounded text-gray-900 dark:text-white"
                      >
                        <option value="">-- Open Slot --</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {members.find(
                          (m) => String(m.id) === String(item.userId),
                        )?.name || "Unassigned"}
                      </span>
                    )}
                  </td>
                  {isAdmin && isEditing && (
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== idx))
                        }
                        className="text-red-500 font-black hover:scale-110 transition-transform"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && !loading && (
            <div className="p-10 text-center font-bold text-gray-400 italic">
              No slots found. Use "Auto-Generate" or "Add Slot" to start.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
