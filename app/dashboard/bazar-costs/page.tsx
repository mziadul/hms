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

  // --- 1. Dynamic Year & Month Lists ---
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

  // --- 2. State Management ---
  const [members, setMembers] = useState<Member[]>([]);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<BazarItem[]>([]);
  const [originalItems, setOriginalItems] = useState<BazarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // --- 3. Fetch Members on Page Load ---
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

  // --- 4. Data Fetching ---
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

    // 1. Validation: Ensure all current rows are valid
    const isInvalid = items.some(
      (i) => !i.userId || i.amount === null || isNaN(i.amount),
    );
    if (isInvalid) {
      alert("Please ensure all rows have a Member and a valid Amount.");
      return;
    }

    // 2. DIRTY CHECKING: Only send New rows or rows where values changed
    const changedItems = items.filter((item) => {
      // If it doesn't have an ID, it's a brand new row -> SEND IT
      if (!item.id) return true;

      // Find the original version of this row
      const original = originalItems.find((o) => o.id === item.id);

      // Compare current values vs original values
      return (
        !original ||
        item.userId !== original.userId ||
        item.amount !== original.amount ||
        item.status !== original.status
      );
    });

    // 3. Deletion Handling: IDs that are still present in the table
    const activeIds = items.filter((i) => i.id).map((i) => i.id);

    // If no changes and no deletions occurred, just exit edit mode
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
        fetchBazarCosts(); // Reload to get fresh IDs and original state
        alert("Sync successful: Only changed rows were updated.");
      }
    } catch (err) {
      alert("Save failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      <Spinner isLoading={loading} message="Updating Bazar Records..." />

      <h1 className="text-2xl font-black uppercase tracking-tighter mb-6 border-b-4 border-black dark:border-blue-500 pb-2 inline-block">
        Bazar Manager
      </h1>

      {/* --- Filter Bar --- */}
      <div className="flex flex-wrap items-end gap-4 mb-8 p-6 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <label className="block text-[10px] font-black uppercase mb-1 opacity-60">
            Year
          </label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            disabled={isEditing}
            className="bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-500 px-3 py-2 font-bold outline-none cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase mb-1 opacity-60">
            Month
          </label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            disabled={isEditing}
            className="bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-500 px-3 py-2 font-bold outline-none cursor-pointer"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchBazarCosts}
          disabled={isEditing}
          className="px-6 py-2.5 bg-black text-white dark:bg-blue-600 dark:hover:bg-blue-700 font-black uppercase text-xs transition-all disabled:opacity-30 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]"
        >
          Search Data
        </button>

        <div className="flex gap-2 ml-auto">
          {!isEditing ? (
            <button
              disabled={!hasSearched}
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 border-2 border-black dark:border-gray-400 font-black uppercase text-xs"
            >
              Edit Period
            </button>
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
                className="px-4 py-2 bg-green-600 text-white font-black uppercase text-xs"
              >
                + Add Cost
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white font-black uppercase text-xs"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  fetchBazarCosts();
                }}
                className="px-4 py-2 border-2 border-gray-400 font-black uppercase text-xs"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* --- Table --- */}
      {!hasSearched ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-300 dark:border-gray-700">
          <p className="font-black uppercase text-gray-400">
            Fetch data to manage Bazar
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border-2 border-black dark:border-gray-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)]">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-200 dark:bg-gray-800 border-b-2 border-black dark:border-gray-700 font-black uppercase">
              <tr>
                <th className="px-6 py-4 border-r border-black/10 w-10 text-center">
                  X
                </th>
                <th className="px-6 py-4 border-r border-black/10">
                  Member Name
                </th>
                <th className="px-6 py-4 border-r border-black/10">Amount</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {items.map((item, idx) => (
                <tr
                  key={idx}
                  className={`${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-100/50 dark:bg-gray-800/40"}`}
                >
                  <td className="px-6 py-4 border-r border-black/10 text-center">
                    {isEditing && (
                      <button
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== idx))
                        }
                        className="text-red-500 font-black"
                      >
                        ✕
                      </button>
                    )}
                  </td>

                  {/* User Dropdown Column */}
                  <td className="px-6 py-4 min-w-[200px] border-r border-black/10 font-bold">
                    {isEditing ? (
                      <select
                        value={item.userId}
                        onChange={(e) =>
                          handleInputChange(idx, "userId", e.target.value)
                        }
                        className="w-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 p-1.5 rounded outline-none text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select Member</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      members.find((m) => String(m.id) === String(item.userId))
                        ?.name ||
                      item.userId ||
                      "Unknown"
                    )}
                  </td>

                  <td className="px-6 py-4 border-r border-black/10 font-mono">
                    {isEditing ? (
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
                        className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-600 outline-none font-black text-blue-600 dark:text-blue-400"
                      />
                    ) : (
                      <span className="font-black text-blue-600 dark:text-blue-400">
                        {item.amount?.toLocaleString() ?? "0"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 min-w-[200px]">
                    {isEditing ? (
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleInputChange(idx, "status", e.target.value)
                        }
                        className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 px-2 py-1.5 rounded outline-none font-black text-xs text-gray-900 dark:text-gray-100"
                      >
                        <option
                          value="active"
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                          ACTIVE
                        </option>
                        <option
                          value="inactive"
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                          INACTIVE
                        </option>
                      </select>
                    ) : (
                      <span
                        className={`px-3 py-1 text-[10px] font-black uppercase border-2 ${item.status === "active" ? "bg-green-100 text-green-700 border-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 border-red-600 dark:bg-red-900/30 dark:text-red-400"}`}
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
      )}

      {/* --- Summary Card --- */}
      {items.length > 0 && (
        <div className="mt-8 flex justify-end">
          <div className="bg-black text-white dark:bg-blue-600 p-6 border-b-8 border-r-8 border-gray-300 dark:border-blue-900">
            <p className="text-[10px] font-black uppercase tracking-tighter opacity-70 mb-1">
              Total Monthly Bazar
            </p>
            <p className="text-4xl font-black italic tracking-tighter">
              {items
                .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
                .toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
