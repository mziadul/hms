"use client";

import { useState, useMemo, useEffect } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";

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
  const now = new Date();
  const [members, setMembers] = useState<Member[]>([]);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<DateRangeItem[]>([]);
  const [loading, setLoading] = useState(true); // Initial state true rakhlam
  const [isEditing, setIsEditing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Initial user fetch
  useEffect(() => {
    const token = localStorage.getItem("userToken");
    setLoading(true); // Loader start
    api
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: { action: "getUsers", token },
      })
      .then((res) => {
        if (Array.isArray(res.data)) setMembers(res.data);
      })
      .finally(() => setLoading(false)); // Member load hole loader off
  }, []);

  const calculateSlots = (
    year: number,
    month: number,
    eligibleMembers: Member[],
  ) => {
    if (eligibleMembers.length === 0) return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const numMembers = eligibleMembers.length;
    const baseDays = Math.floor(daysInMonth / numMembers);
    const remainder = daysInMonth % numMembers;
    const slots = [];
    let currentDay = 1;
    for (let i = 0; i < numMembers; i++) {
      const hasExtraDay = i >= numMembers - remainder;
      const duration = baseDays + (hasExtraDay ? 1 : 0);
      slots.push({ startDate: currentDay, endDate: currentDay + duration - 1 });
      currentDay += duration;
    }
    return slots;
  };

  const fetchData = async () => {
    const token = localStorage.getItem("userToken");
    setLoading(true); // Data load shuru hole loader on

    const eligible = members.filter((m) => m.name.toLowerCase() !== "omar");
    if (eligible.length === 0) {
      alert("No members found to distribute!");
      setLoading(false);
      return;
    }

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
      const slots = calculateSlots(filterYear, filterMonth, eligible);
      const syncedItems = slots.map((slot) => {
        const found = existingData.find(
          (d) => Number(d.startDate) === slot.startDate,
        );
        return {
          id: found?.id,
          userId: found?.userId || "",
          year: filterYear,
          month: filterMonth,
          startDate: slot.startDate,
          endDate: slot.endDate,
        };
      });
      setItems(syncedItems);
      setHasSearched(true);
      setIsEditing(false);
    } catch (err) {
      alert("Error fetching data");
    } finally {
      setLoading(false); // Shob kaj shesh hole loader off
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const dataToSave = items.filter((i) => i.userId !== "");
      params.append(
        "data",
        JSON.stringify({
          items: dataToSave,
          activeIds: dataToSave.map((i) => i.id).filter(Boolean),
        }),
      );
      await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=upsertDateRanges&token=${token}&year=${filterYear}&month=${filterMonth}`,
        params,
      );
      fetchData();
      alert("Synced successfully!");
    } catch (err) {
      alert("Error saving data");
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <Spinner isLoading={loading} message="Processing..." />

      <h1 className="text-2xl font-black uppercase mb-6 border-b-4 border-black dark:border-purple-500 inline-block">
        Bazar Slot Manager
      </h1>

      <div className="flex flex-wrap items-end gap-4 mb-8 p-6 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <label className="block text-[10px] font-black uppercase mb-1 dark:text-gray-400">
            Year
          </label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-600 px-3 py-2 font-bold outline-none text-gray-900 dark:text-white"
          >
            {[2026, 2025, 2024].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase mb-1 dark:text-gray-400">
            Month
          </label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-600 px-3 py-2 font-bold outline-none text-gray-900 dark:text-white"
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

        <button
          onClick={fetchData}
          className="px-6 py-2.5 bg-black text-white dark:bg-purple-600 font-black uppercase text-xs active:scale-95 transition-transform"
        >
          Load Distribution
        </button>

        <div className="flex gap-2 ml-auto">
          {!isEditing ? (
            <button
              disabled={!hasSearched || loading}
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 border-2 border-black dark:border-gray-500 font-black uppercase text-xs dark:text-white disabled:opacity-30"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white font-black uppercase text-xs"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  fetchData();
                }}
                className="px-4 py-2 border-2 border-gray-400 font-black uppercase text-xs dark:text-gray-300"
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
            <thead className="bg-gray-200 dark:bg-gray-800 border-b-2 border-black dark:border-gray-700 font-black uppercase">
              <tr>
                <th className="px-6 py-4 border-r border-black/10 dark:border-gray-700 dark:text-white">
                  Date Range
                </th>
                <th className="px-6 py-4 dark:text-white">Member Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {items.map((item, idx) => (
                <tr key={idx} className="bg-white dark:bg-gray-900">
                  <td className="px-6 py-4 border-r border-black/10 dark:border-gray-700 font-mono font-bold text-purple-600 dark:text-purple-400">
                    Day {item.startDate} — Day {item.endDate}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={item.userId}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].userId = e.target.value;
                          setItems(updated);
                        }}
                        className="w-full bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 p-2 font-bold rounded text-gray-900 dark:text-white"
                      >
                        <option value="">-- Select Member --</option>
                        {members
                          .filter((m) => m.name.toLowerCase() !== "omar")
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="font-bold text-gray-900 dark:text-gray-200">
                        {members.find(
                          (m) => String(m.id) === String(item.userId),
                        )?.name || "Not Assigned"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
