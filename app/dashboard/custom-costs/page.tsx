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

    // Strict Admin Check
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
      alert("Assignments synced successfully!");
    } catch (err) {
      alert("Sync failed.");
    } finally {
      setLoading(false);
    }
  };

  // Prevent UI flicker for unauthorized users
  if (!isAuthorized) {
    return <Spinner isLoading={true} message="Verifying access..." />;
  }

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      <Spinner isLoading={loading} message="Processing rules..." />

      <div className="flex justify-between items-center mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
        <h1 className="text-2xl font-bold uppercase tracking-wider">
          Custom Assignments
        </h1>
        <div className="flex gap-3">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 border-2 border-gray-800 dark:border-gray-400 font-black hover:bg-gray-800 hover:text-white dark:hover:bg-gray-400 dark:hover:text-gray-900 text-xs uppercase transition-colors"
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
                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 border-2 border-green-600 text-green-700 dark:text-green-400 font-black uppercase text-xs"
              >
                + Add Rule
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 border-2 border-blue-700 text-white font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Save Sync
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setItems(JSON.parse(JSON.stringify(originalItems)));
                }}
                className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 font-black uppercase text-xs"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-xl shadow-md">
        <table className="min-w-full text-sm text-left border-separate border-spacing-0">
          <thead className="bg-gray-200 dark:bg-gray-800 font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
            <tr>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 w-16 text-center">
                X
              </th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700">
                Member Name
              </th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700">
                Cost Head
              </th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 text-right">
                Fixed Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 dark:divide-gray-700">
            {items.map((item, idx) => {
              const isChanged =
                isEditing &&
                JSON.stringify(item) !== JSON.stringify(originalItems[idx]);
              return (
                <tr
                  key={idx}
                  className={`${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-100 dark:bg-gray-800/40"} ${isChanged ? "bg-yellow-50 dark:bg-yellow-900/10" : "transition-colors"}`}
                >
                  <td className="px-6 py-4 border-r border-gray-200 dark:border-gray-800 text-center">
                    {isEditing && (
                      <button
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== idx))
                        }
                        className="text-red-500 font-black hover:scale-125 transition-transform"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 min-w-[200px] border-r border-gray-200 dark:border-gray-800">
                    {isEditing ? (
                      <select
                        className="w-full bg-white dark:bg-gray-800 border dark:border-gray-600 px-2 py-1 rounded outline-none text-gray-900 dark:text-white"
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
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {members.find(
                          (m) => String(m.id) === String(item.userId),
                        )?.name || "Unknown"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 min-w-[200px] border-r border-gray-200 dark:border-gray-800">
                    {isEditing ? (
                      <select
                        className="w-full bg-white dark:bg-gray-800 border dark:border-gray-600 px-2 py-1 rounded outline-none text-gray-900 dark:text-white"
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
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {costHeads.find(
                          (c) => String(c.id) === String(item.costHeadId),
                        )?.name || "Unknown"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        className="w-full bg-white dark:bg-gray-800 border dark:border-gray-600 px-2 py-1 rounded outline-none text-right text-gray-900 dark:text-white"
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
                    ) : (
                      <span className="font-bold text-orange-600 dark:text-orange-400 italic">
                        {item.amount?.toLocaleString()} Tk
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
