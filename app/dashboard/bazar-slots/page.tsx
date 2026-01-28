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
  startDate: number | null; // Changed to Number for Day
  endDate: number | null;   // Changed to Number for Day
}

export default function DateRangesPage() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const years = useMemo(() => {
    const arr = [];
    for (let y = 2024; y <= currentYear; y++) arr.push(y);
    return arr.reverse();
  }, [currentYear]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      name: new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2000, i, 1)),
      value: i + 1,
    }));
  }, []);

  const [members, setMembers] = useState<Member[]>([]);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<DateRangeItem[]>([]);
  const [originalItems, setOriginalItems] = useState<DateRangeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    api.get(process.env.NEXT_PUBLIC_GAS_URL!, { params: { action: "getUsers", token } })
      .then((res) => { if (Array.isArray(res.data)) setMembers(res.data); });
  }, []);

  const fetchData = () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    setHasSearched(true);
    setIsEditing(false);

    api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
      params: { action: "getBazarSlots", token, year: filterYear, month: filterMonth },
    })
    .then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setItems(data);
      setOriginalItems(JSON.parse(JSON.stringify(data)));
    })
    .finally(() => setLoading(false));
  };

  const handleInputChange = (idx: number, field: keyof DateRangeItem, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");
    
    const changedItems = items.filter(item => {
      if (!item.id) return true;
      const orig = originalItems.find(o => o.id === item.id);
      return !orig || JSON.stringify(item) !== JSON.stringify(orig);
    });

    const activeIds = items.filter(i => i.id).map(i => i.id);

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("data", JSON.stringify({ items: changedItems, activeIds }));
      const url = `${process.env.NEXT_PUBLIC_GAS_URL}?action=upsertDateRanges&token=${token}&year=${filterYear}&month=${filterMonth}`;
      
      await api.post(url, params);
      fetchData();
      alert("Slot days synced successfully");
    } catch (err) {
      alert("Error saving data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <Spinner isLoading={loading} message="Syncing Days..." />

      <h1 className="text-2xl font-black uppercase tracking-tighter mb-6 border-b-4 border-black dark:border-purple-500 pb-2 inline-block">
        Bazar Slot Manager
      </h1>

      <div className="flex flex-wrap items-end gap-4 mb-8 p-6 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Year</label>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-500 px-3 py-2 font-bold outline-none">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Month</label>
          <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-500 px-3 py-2 font-bold outline-none">
            {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
          </select>
        </div>
        <button onClick={fetchData} className="px-6 py-2.5 bg-black text-white dark:bg-purple-600 font-black uppercase text-xs">
          Load Slots
        </button>

        <div className="flex gap-2 ml-auto">
          {!isEditing ? (
            <button disabled={!hasSearched} onClick={() => setIsEditing(true)} className="px-6 py-2 border-2 border-black dark:border-gray-400 font-black uppercase text-xs">Edit</button>
          ) : (
            <>
              <button onClick={() => setItems([...items, { userId: "", year: filterYear, month: filterMonth, startDate: null, endDate: null }])} className="px-4 py-2 bg-green-600 text-white font-black uppercase text-xs">+ Slot</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white font-black uppercase text-xs">Save Sync</button>
              <button onClick={() => { setIsEditing(false); fetchData(); }} className="px-4 py-2 border-2 border-gray-400 font-black uppercase text-xs">Cancel</button>
            </>
          )}
        </div>
      </div>

      {!hasSearched ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-300 dark:border-gray-700">
          <p className="font-black uppercase text-gray-400">Search to manage Days</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-2 border-black dark:border-gray-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)]">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-200 dark:bg-gray-800 border-b-2 border-black dark:border-gray-700 font-black uppercase">
              <tr>
                <th className="px-6 py-4 border-r border-black/10 w-10 text-center">X</th>
                <th className="px-6 py-4 border-r border-black/10">Member Name</th>
                <th className="px-6 py-4 border-r border-black/10">Start Day</th>
                <th className="px-6 py-4">End Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {items.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/40"}>
                  <td className="px-6 py-4 border-r border-black/10 text-center">
                    {isEditing && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500 font-black">✕</button>}
                  </td>
                  <td className="px-6 py-4 border-r border-black/10">
                    {isEditing ? (
                      <select value={item.userId} onChange={(e) => handleInputChange(idx, "userId", e.target.value)} className="w-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 p-1 font-bold rounded">
                        <option value="">Select Member</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    ) : (
                      <span className="font-bold">{members.find(m => String(m.id) === String(item.userId))?.name || "Unknown"}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 border-r border-black/10 font-mono">
                    {isEditing ? (
                      <input type="number" min="1" max="31" value={item.startDate ?? ""} onChange={(e) => handleInputChange(idx, "startDate", e.target.value === "" ? null : Number(e.target.value))} className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-600 outline-none" placeholder="1-31" />
                    ) : <span className="font-black text-purple-600 dark:text-purple-400">{item.startDate}</span>}
                  </td>
                  <td className="px-6 py-4 font-mono">
                    {isEditing ? (
                      <input type="number" min="1" max="31" value={item.endDate ?? ""} onChange={(e) => handleInputChange(idx, "endDate", e.target.value === "" ? null : Number(e.target.value))} className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-600 outline-none" placeholder="1-31" />
                    ) : <span className="font-black text-purple-600 dark:text-purple-400">{item.endDate}</span>}
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