"use client";

import { useState, useEffect } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
}
interface CostHead {
  id: string;
  name: string;
}
interface CustomValueItem {
  userId: string;
  costHeadId: string;
  amount: number | null;
}

export default function CustomValuesPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [costHeads, setCostHeads] = useState<CostHead[]>([]);
  const [items, setItems] = useState<CustomValueItem[]>([]);
  const [originalItems, setOriginalItems] = useState<CustomValueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
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
    fetchData();
  }, [router]);

  const fetchData = async () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    try {
      const [resUsers, resData] = await Promise.all([
        api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
          params: { action: "getUsers", token },
        }),
        api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
          params: { action: "getCustomValuesData", token },
        }),
      ]);

      const userData = Array.isArray(resUsers.data) ? resUsers.data : [];
      const costHeadData = resData.data?.costHeads || [];
      const rawCustomValues = resData.data?.customValues || {};

      const flattened: CustomValueItem[] = [];
      Object.keys(rawCustomValues).forEach((uId) => {
        Object.keys(rawCustomValues[uId]).forEach((cId) => {
          flattened.push({
            userId: uId,
            costHeadId: cId,
            amount: rawCustomValues[uId][cId],
          });
        });
      });

      setMembers(userData);
      setCostHeads(costHeadData);
      setItems(flattened);
      setOriginalItems(JSON.parse(JSON.stringify(flattened)));
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    idx: number,
    field: keyof CustomValueItem,
    value: any,
  ) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");
    for (let i = 0; i < items.length; i++) {
      if (
        !items[i].userId ||
        !items[i].costHeadId ||
        items[i].amount === null
      ) {
        alert(`Row ${i + 1}: All fields are required.`);
        return;
      }
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("data", JSON.stringify({ items }));
      await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=upsertCustomValues&token=${token}`,
        params,
      );

      setIsEditing(false);
      fetchData();
      alert("✅ Saved successfully!");
    } catch (err) {
      alert("❌ Save failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return <Spinner isLoading={true} message="Verifying access..." />;
  }

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Spinner isLoading={loading} message="Processing rules..." />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight border-l-4 border-teal-500 pl-3">
            Custom Assignments
          </h1>
          <p className="text-xs opacity-60 mt-1">
            Apply specific fixed costs to individual members
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
                onClick={() =>
                  setItems([
                    ...items,
                    { userId: "", costHeadId: "", amount: null },
                  ])
                }
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-1"
              >
                <span>+</span> Add Rule
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
                  setItems(JSON.parse(JSON.stringify(originalItems)));
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
                <th className="p-5">Member Name</th>
                <th className="p-5">Cost Head</th>
                <th className="p-5 text-right">Fixed Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item, idx) => {
                const isChanged =
                  isEditing &&
                  JSON.stringify(item) !== JSON.stringify(originalItems[idx]);
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group ${isChanged ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}
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
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold transition-all"
                          value={item.userId}
                          onChange={(e) =>
                            handleInputChange(idx, "userId", e.target.value)
                          }
                        >
                          <option value="">Select Member</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {members.find(
                            (m) => String(m.id) === String(item.userId),
                          )?.name || "Unknown"}
                        </span>
                      )}
                    </td>
                    <td className="p-5">
                      {isEditing ? (
                        <select
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold transition-all"
                          value={item.costHeadId}
                          onChange={(e) =>
                            handleInputChange(idx, "costHeadId", e.target.value)
                          }
                        >
                          <option value="">Select Head</option>
                          {costHeads.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {costHeads.find(
                            (c) => String(c.id) === String(item.costHeadId),
                          )?.name || "Unknown"}
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-right font-mono">
                      {isEditing ? (
                        <div className="flex justify-end">
                          <input
                            type="number"
                            className="w-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-right text-sm font-black text-blue-600 dark:text-blue-400 transition-all"
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
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <span className="font-black text-gray-900 dark:text-gray-100">
                          {item.amount?.toLocaleString()}{" "}
                          <span className="text-[10px] font-bold opacity-60">
                            TK
                          </span>
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
    </div>
  );
}
