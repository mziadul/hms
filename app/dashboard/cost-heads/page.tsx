"use client";

import { useEffect, useState } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";

interface CostHead {
  id?: string;
  name: string;
  amount: number | null;
  type: string;
}

export default function CostHeadsPage() {
  const router = useRouter();
  const [costHeads, setCostHeads] = useState<CostHead[]>([]);
  const [originalHeads, setOriginalHeads] = useState<CostHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const info = localStorage.getItem("userInfo");
    const token = localStorage.getItem("userToken");

    if (!token || !info) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(info);
    if (userData.type !== "admin") {
      router.replace("/dashboard");
      return;
    }

    setIsAuthorized(true);
    fetchCostHeads();
  }, [router]);

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
    setCostHeads([...costHeads, { name: "", amount: null, type: "Postpaid" }]);
  };

  const removeRow = (index: number) => {
    if (confirm("Are you sure you want to remove this cost head?")) {
      setCostHeads(costHeads.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");

    for (let i = 0; i < costHeads.length; i++) {
      const item = costHeads[i];
      if (!item.name || item.name.trim() === "") {
        alert(`Error in Row ${i + 1}: Name is required.`);
        return;
      }
      if (item.amount === null || isNaN(item.amount)) {
        alert(`Error in Row ${i + 1}: Valid amount is required.`);
        return;
      }
    }

    const changedHeads = costHeads.filter((item) => {
      if (!item.id) return true;
      const original = originalHeads.find((o) => o.id === item.id);
      return !original || JSON.stringify(item) !== JSON.stringify(original);
    });

    const activeIds = costHeads.filter((h) => h.id).map((h) => h.id);

    if (
      changedHeads.length === 0 &&
      activeIds.length === originalHeads.length
    ) {
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
      alert("✅ Cost heads updated successfully!");
    } catch (err) {
      alert("❌ Failed to save. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return <Spinner isLoading={true} message="Verifying access..." />;
  }

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Spinner isLoading={loading} message="Processing Budgeting..." />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight border-l-4 border-teal-500 pl-3">
            Cost Head Manager
          </h1>
          <p className="text-xs opacity-60 mt-1">
            Define and manage fixed cost categories and budgets
          </p>
        </div>

        {/* BUTTON GROUP PILL CONTAINER */}
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
                onClick={addNewRow}
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-1"
              >
                <span>+</span> Add Head
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
                  setCostHeads(JSON.parse(JSON.stringify(originalHeads)));
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase tracking-widest font-black opacity-70">
                <th className="p-5 w-16 text-center">X</th>
                <th className="p-5">Ref ID</th>
                <th className="p-5">Head Name</th>
                <th className="p-5 text-right">Base Amount</th>
                <th className="p-5 text-center">Payment Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {costHeads.map((c, idx) => {
                const isChanged =
                  isEditing &&
                  c.id &&
                  JSON.stringify(c) !==
                    JSON.stringify(originalHeads.find((o) => o.id === c.id));
                return (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group"
                  >
                    <td className="p-5 text-center">
                      {isEditing ? (
                        <button
                          onClick={() => removeRow(idx)}
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
                    <td className="p-5 font-mono text-[10px] font-bold text-gray-400">
                      {c.id || (
                        <span className="text-emerald-500 italic">NEW</span>
                      )}
                    </td>
                    <td className="p-5">
                      {isEditing ? (
                        <input
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold transition-all"
                          value={c.name}
                          onChange={(e) =>
                            handleInputChange(idx, "name", e.target.value)
                          }
                          placeholder="e.g. Electricity Bill"
                        />
                      ) : (
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {c.name}
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-right">
                      {isEditing ? (
                        <div className="flex justify-end">
                          <input
                            type="number"
                            className="w-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-right text-sm font-black text-blue-600 dark:text-blue-400 transition-all"
                            value={c.amount ?? ""}
                            onChange={(e) =>
                              handleInputChange(
                                idx,
                                "amount",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <span className="font-black text-blue-600 dark:text-blue-400">
                          {c.amount?.toLocaleString() ?? "0"}{" "}
                          <span className="text-[10px]">TK</span>
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-center">
                      {isEditing ? (
                        <select
                          className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-xs font-black transition-all"
                          value={c.type}
                          onChange={(e) =>
                            handleInputChange(idx, "type", e.target.value)
                          }
                        >
                          <option value="Prepaid">Prepaid</option>
                          <option value="Postpaid">Postpaid</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${
                            c.type === "Prepaid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                          }`}
                        >
                          {c.type}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {costHeads.length === 0 && !loading && (
            <div className="p-16 text-center text-gray-400 font-bold italic tracking-widest">
              No cost heads defined yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
