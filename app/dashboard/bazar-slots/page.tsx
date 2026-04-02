"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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

  const currentYear = now.getFullYear();

  const years = useMemo(() => {
    const arr = [];
    for (let y = 2024; y <= currentYear; y++) arr.push(y);
    return arr.reverse();
  }, [currentYear]);

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

  const handleAutoCalculate = () => {
    const excludedNamesRaw = process.env.NEXT_PUBLIC_EXCLUDED_NAMES || "";

    const excludedNames = excludedNamesRaw
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name !== ""); // Remove empty strings from extra commas

    const eligible = members.filter((m) => {
      const memberName = m.name.toLowerCase();
      return !excludedNames.includes(memberName);
    });

    if (eligible.length === 0) {
      return alert(
        "Member list is empty after exclusions. Please check your settings.",
      );
    }

    const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
    const numMembers = eligible.length;
    const baseDays = Math.floor(daysInMonth / numMembers);
    const remainder = daysInMonth % numMembers;

    let currentDay = 1;
    const newSlots = eligible.map((_, i) => {
      const hasExtraDay = i >= numMembers - remainder;
      const duration = baseDays + (hasExtraDay ? 1 : 0);
      const slot = {
        userId: "",
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
      alert("Error fetching slots.");
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

      const res = await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=upsertDateRanges&token=${token}&year=${filterYear}&month=${filterMonth}`,
        params,
      );

      if (res.data.success) {
        const skipped = res.data.skipped || [];
        const inserted = res.data.inserted || 0;

        if (skipped.length > 0) {
          alert(
            `⚠️ Partial Update!\n\n✅ ${inserted} slots saved.\n❌ Skipped: ${skipped.join(", ")}\n\nReason: These slots were already occupied.`,
          );
        } else {
          alert("✅ Slots saved successfully!");
        }
        await fetchData();
      } else {
        alert("❌ Error: " + res.data.message);
        setLoading(false);
      }
    } catch (err) {
      alert("❌ Error saving data");
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
    <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Spinner isLoading={loading} message="Syncing Slots..." />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight border-l-4 border-teal-500 pl-3">
            Bazar Slot Manager
          </h1>
          <p className="text-xs opacity-60 mt-1">
            Assign and manage bazaar schedules for members
          </p>
        </div>

        {/* CONTROLS PILL CONTAINER */}
        <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-inner w-full md:w-auto">
          <div className="flex gap-1 mr-2 border-r border-gray-300 dark:border-gray-600 pr-2">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="bg-white dark:bg-gray-700 p-1.5 px-3 rounded-lg font-bold text-xs outline-none border border-transparent focus:border-teal-500 transition-all"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="bg-white dark:bg-gray-700 p-1.5 px-3 rounded-lg font-bold text-xs outline-none border border-transparent focus:border-teal-500 transition-all"
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

          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={fetchData}
                  className="px-4 py-2 bg-blue-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-blue-700 transition-all"
                >
                  View Schedule
                </button>
                {isAdmin && (
                  <button
                    onClick={handleAutoCalculate}
                    className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold text-[10px] uppercase rounded-lg border border-gray-200 dark:border-gray-600 hover:border-teal-500 transition-all"
                  >
                    Auto-Generate
                  </button>
                )}
                <button
                  disabled={!hasSearched || loading}
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 font-black uppercase text-[10px] rounded-lg shadow-md hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isAdmin ? "Edit Mode" : "Claim Slot"}
                </button>
              </>
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
                    className="px-4 py-2 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-emerald-700 transition-all"
                  >
                    + Add Slot
                  </button>
                )}
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-blue-700 transition-all"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    fetchData();
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold uppercase text-[10px] rounded-lg"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      {hasSearched ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase tracking-widest font-black opacity-70">
                  <th className="p-5 text-center">Start Day</th>
                  <th className="p-5 text-center">End Day</th>
                  <th className="p-5">Assigned Member</th>
                  {isAdmin && isEditing && (
                    <th className="p-5 text-center">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group"
                  >
                    <td className="p-5 text-center">
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
                          className="w-16 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      ) : (
                        <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                          {item.startDate}
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-center">
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
                          className="w-16 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      ) : (
                        <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                          {item.endDate}
                        </span>
                      )}
                    </td>
                    <td className="p-5">
                      {isEditing ? (
                        <select
                          value={item.userId}
                          onChange={(e) =>
                            handleInputChange(idx, "userId", e.target.value)
                          }
                          className="w-full max-w-[250px] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">-- Open Slot --</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div
                          className={`font-bold ${item.userId ? "text-gray-800 dark:text-gray-100" : "text-gray-400 italic"}`}
                        >
                          {members.find(
                            (m) => String(m.id) === String(item.userId),
                          )?.name || "Unassigned Slot"}
                        </div>
                      )}
                    </td>
                    {isAdmin && isEditing && (
                      <td className="p-5 text-center">
                        <button
                          onClick={() =>
                            setItems(items.filter((_, i) => i !== idx))
                          }
                          className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
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
              <div className="p-16 text-center text-gray-400 font-bold italic tracking-widest">
                No slots found. Use Load or Auto-Generate.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-24 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-lg font-bold opacity-30 uppercase tracking-widest">
            Load Existing Data to View Slots
          </p>
        </div>
      )}
    </div>
  );
}
