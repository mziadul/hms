"use client";

import { useState, useMemo, useEffect } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";

interface Member {
  id: string;
  name: string;
}

interface BazarItem {
  id?: string;
  userId: string;
  year: number;
  month: number;
  amount: number | null;
  status: "active" | "inactive";
}

export default function BazarCostsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const years = useMemo(() => {
    const arr = [];
    for (let y = 2024; y <= currentYear; y++) arr.push(y);
    return arr.reverse();
  }, [currentYear]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      name: new Intl.DateTimeFormat("en-US", { month: "long" }).format(
        new Date(2000, i, 1),
      ),
      value: i + 1,
    }));
  }, []);

  const [members, setMembers] = useState<Member[]>([]);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<BazarItem[]>([]);
  const [originalItems, setOriginalItems] = useState<BazarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    api
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: { action: "getUsers", token },
      })
      .then((res) => {
        if (Array.isArray(res.data)) setMembers(res.data);
      })
      .catch((err) => console.error("Failed to load members", err));
  }, []);

  const fetchBazarCosts = () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    setHasSearched(true);
    setIsEditing(false);

    api
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: {
          action: "getBazarCosts",
          token,
          year: filterYear,
          month: filterMonth,
        },
      })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setItems(data);
        setOriginalItems(JSON.parse(JSON.stringify(data)));
      })
      .finally(() => setLoading(false));
  };

  const handleInputChange = (
    idx: number,
    field: keyof BazarItem,
    value: any,
  ) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");
    const isInvalid = items.some(
      (i) => !i.userId || i.amount === null || isNaN(i.amount),
    );
    if (isInvalid) {
      alert("Please ensure all rows have a Member and a valid Amount.");
      return;
    }

    const changedItems = items.filter((item) => {
      if (!item.id) return true;
      const original = originalItems.find((o) => o.id === item.id);
      return (
        !original ||
        item.userId !== original.userId ||
        item.amount !== original.amount ||
        item.status !== original.status
      );
    });

    const activeIds = items.filter((i) => i.id).map((i) => i.id);

    if (
      changedItems.length === 0 &&
      activeIds.length === originalItems.length
    ) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("data", JSON.stringify({ items: changedItems, activeIds }));

      const url = `${process.env.NEXT_PUBLIC_GAS_URL}?action=upsertBazarCosts&token=${token}&year=${filterYear}&month=${filterMonth}`;
      const res = await api.post(url, params);

      if (res.data.success) {
        setIsEditing(false);
        fetchBazarCosts();
        alert("✅ Bazar records synchronized!");
      }
    } catch (err) {
      alert("❌ Save failed. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Spinner isLoading={loading} message="Processing Bazar Records..." />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight border-l-4 border-teal-500 pl-3">
            Bazar Manager
          </h1>
          <p className="text-xs opacity-60 mt-1">
            Track and manage monthly bazaar expenses for members
          </p>
        </div>

        {/* BUTTON & FILTER GROUP */}
        <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-inner w-full md:w-auto">
          <div className="flex gap-1 mr-2 border-r border-gray-300 dark:border-gray-600 pr-2">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              disabled={isEditing}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-1.5 px-3 rounded-lg outline-none font-bold text-xs shadow-sm border border-transparent focus:border-teal-500 transition-all"
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
              disabled={isEditing}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-1.5 px-3 rounded-lg outline-none font-bold text-xs shadow-sm border border-transparent focus:border-teal-500 transition-all"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {!isEditing ? (
            <>
              <button
                onClick={fetchBazarCosts}
                className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-blue-700 transition-all"
              >
                Search
              </button>
              <button
                disabled={!hasSearched}
                onClick={() => setIsEditing(true)}
                className="flex-1 md:flex-none px-6 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold text-[10px] uppercase rounded-lg border border-gray-200 dark:border-gray-600 hover:border-teal-500 transition-all disabled:opacity-50"
              >
                Edit Mode
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() =>
                  setItems([
                    ...items,
                    {
                      userId: "",
                      year: filterYear,
                      month: filterMonth,
                      amount: null,
                      status: "active",
                    },
                  ])
                }
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-emerald-700 transition-all"
              >
                + Add Cost
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
                  fetchBazarCosts();
                }}
                className="flex-1 md:flex-none px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold uppercase text-[10px] rounded-lg transition-all"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* TABLE SECTION */}
      {!hasSearched ? (
        <div className="text-center py-24 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-lg font-bold opacity-30 uppercase tracking-widest">
            Select Period and Fetch Data
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase tracking-widest font-black opacity-70">
                  <th className="p-5 w-16 text-center">X</th>
                  <th className="p-5">Member Name</th>
                  <th className="p-5 text-center">Bazar Amount</th>
                  <th className="p-5 text-center">Record Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group"
                  >
                    <td className="p-5 text-center">
                      {isEditing ? (
                        <button
                          onClick={() =>
                            setItems(items.filter((_, i) => i !== idx))
                          }
                          className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                        >
                          ✕
                        </button>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-700">
                          —
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
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold transition-all"
                        >
                          <option value="">Select Member</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="font-bold text-gray-800 dark:text-gray-100">
                          {members.find(
                            (m) => String(m.id) === String(item.userId),
                          )?.name || "Unknown Member"}
                        </div>
                      )}
                    </td>

                    <td className="p-5 text-center">
                      {isEditing ? (
                        <div className="flex justify-center">
                          <input
                            type="number"
                            value={item.amount ?? ""}
                            onChange={(e) =>
                              handleInputChange(
                                idx,
                                "amount",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                            className="w-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-center font-black text-blue-600 dark:text-blue-400"
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <span className="font-black text-blue-600 dark:text-blue-400 text-lg">
                          {item.amount?.toLocaleString() ?? "0"}{" "}
                          <span className="text-[10px]">TK</span>
                        </span>
                      )}
                    </td>

                    <td className="p-5 text-center">
                      {isEditing ? (
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleInputChange(idx, "status", e.target.value)
                          }
                          className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-xs font-black transition-all"
                        >
                          <option value="active">ACTIVE</option>
                          <option value="inactive">INACTIVE</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${
                            item.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUMMARY BOX */}
      {items.length > 0 && (
        <div className="mt-8 flex justify-end">
          <div className="bg-gray-900 dark:bg-teal-600 text-white p-6 rounded-2xl shadow-2xl border-b-4 border-teal-500 dark:border-teal-800 min-w-[250px]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
              Total Monthly Bazar
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black italic tracking-tighter">
                {items
                  .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
                  .toLocaleString()}
              </span>
              <span className="text-sm font-bold opacity-80">TK</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
