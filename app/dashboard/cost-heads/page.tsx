"use client";

import { useEffect, useState } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";

interface CostHead {
  id?: string;
  name: string;
  amount: number | null; // Changed to allow null
  type: string;
}

export default function CostHeadsPage() {
  const [costHeads, setCostHeads] = useState<CostHead[]>([]);
  const [originalHeads, setOriginalHeads] = useState<CostHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCostHeads();
  }, []);

  const fetchCostHeads = () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    api
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: { action: "getCostHeads", token },
      })
      .then((res) => {
        const data = res.data.costHeads || res.data;
        if (Array.isArray(data)) {
          setCostHeads(data);
          setOriginalHeads(JSON.parse(JSON.stringify(data)));
        }
      })
      .catch(() => setError("Failed to fetch data."))
      .finally(() => setLoading(false));
  };

  const handleInputChange = (
    index: number,
    field: keyof CostHead,
    value: any,
  ) => {
    const updated = [...costHeads];
    updated[index] = { ...updated[index], [field]: value };
    setCostHeads(updated);
  };

  const addNewRow = () => {
    // Set amount to null instead of 0
    setCostHeads([...costHeads, { name: "", amount: null, type: "Postpaid" }]);
  };

  const removeRow = (index: number) => {
    if (confirm("Remove this cost head?")) {
      setCostHeads(costHeads.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");

    // 1. STRICT VALIDATION
    for (let i = 0; i < costHeads.length; i++) {
      const item = costHeads[i];
      if (!item.name || item.name.trim() === "") {
        alert(`Error in Row ${i + 1}: Name is required.`);
        return;
      }
      // Strict check: fails if amount is null, undefined, or not a number
      if (item.amount === null || item.amount === undefined || isNaN(item.amount)) {
        alert(`Error in Row ${i + 1}: Amount is required and must be a number.`);
        return;
      }
      if (item.amount < 0) {
        alert(`Error in Row ${i + 1}: Amount cannot be negative.`);
        return;
      }
    }

    // 2. Identify changed or new rows
    const changedHeads = costHeads.filter((item) => {
      if (!item.id) return true;
      const original = originalHeads.find((o) => o.id === item.id);
      return !original || JSON.stringify(item) !== JSON.stringify(original);
    });

    const activeIds = costHeads.filter((h) => h.id).map((h) => h.id);

    if (changedHeads.length === 0 && activeIds.length === originalHeads.length) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append(
        "data",
        JSON.stringify({ costHeads: changedHeads, activeIds }),
      );
      await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=upsertCostHeads&token=${token}`,
        formData,
      );

      setIsEditing(false);
      fetchCostHeads();
      alert("Data saved successfully!");
    } catch (err) {
      alert("Failed to save. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <Spinner isLoading={loading} message="Processing Budget..." />

      <div className="flex justify-between items-center mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
        <h1 className="text-2xl font-bold uppercase tracking-wider">Cost Heads</h1>
        <div className="flex gap-3">
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 border-2 border-gray-800 dark:border-gray-400 font-black hover:bg-gray-800 hover:text-white dark:hover:bg-gray-400 dark:hover:text-gray-900 text-xs uppercase">
              Edit Mode
            </button>
          ) : (
            <>
              <button onClick={addNewRow} className="px-4 py-2 bg-green-100 dark:bg-green-900/30 border-2 border-green-600 text-green-700 dark:text-green-400 font-black uppercase text-xs">
                + Add Head
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 border-2 border-blue-700 text-white font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                Save Sync
              </button>
              <button onClick={() => { setIsEditing(false); setCostHeads(JSON.parse(JSON.stringify(originalHeads))); }} className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 font-black uppercase text-xs">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-xl shadow-md">
        <table className="min-w-full text-sm text-left border-separate border-spacing-0">
          <thead className="bg-gray-200 dark:bg-gray-700 font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
            <tr>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 w-16 text-center">X</th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700">ID</th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700">Name</th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700">Amount</th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 dark:divide-gray-700">
            {costHeads.map((c, idx) => {
              const isChanged = isEditing && c.id && JSON.stringify(c) !== JSON.stringify(originalHeads.find((o) => o.id === c.id));
              return (
                <tr key={idx} className={`${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-100 dark:bg-gray-800/40"} ${isChanged ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}`}>
                  <td className="px-6 py-4 border-r border-gray-200 dark:border-gray-800 text-center">
                    {isEditing && <button onClick={() => removeRow(idx)} className="text-red-500 font-black">✕</button>}
                  </td>
                  <td className="px-6 py-4 border-r border-gray-200 dark:border-gray-800 font-mono font-bold text-gray-500">{c.id || "NEW"}</td>
                  <td className="px-6 py-4 border-r border-gray-200 dark:border-gray-800">
                    {isEditing ? (
                      <input
                        className={`w-full bg-white dark:bg-gray-800 border px-2 py-1 rounded outline-none ${!c.name && isEditing ? 'border-red-400' : 'dark:border-gray-600'}`}
                        value={c.name}
                        onChange={(e) => handleInputChange(idx, "name", e.target.value)}
                        placeholder="Required Name"
                      />
                    ) : <span className="font-bold">{c.name}</span>}
                  </td>
                  <td className="px-6 py-4 border-r border-gray-200 dark:border-gray-800">
                    {isEditing ? (
                      <input
                        type="number"
                        className={`w-full bg-white dark:bg-gray-800 border px-2 py-1 rounded outline-none ${c.amount === null && isEditing ? 'border-red-400' : 'dark:border-gray-600'}`}
                        value={c.amount ?? ""} // Ensures input is empty if null
                        onChange={(e) => handleInputChange(idx, "amount", e.target.value === "" ? null : Number(e.target.value))}
                        placeholder="0.00"
                      />
                    ) : <span>{c.amount?.toLocaleString() ?? "0"}</span>}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select className="w-full bg-white dark:bg-gray-800 border dark:border-gray-600 px-1 py-1 rounded outline-none" value={c.type} onChange={(e) => handleInputChange(idx, "type", e.target.value)}>
                        <option value="Prepaid">Prepaid</option>
                        <option value="Postpaid">Postpaid</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${c.type === "Prepaid" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"}`}>
                        {c.type}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}