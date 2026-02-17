"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import React from "react";
import { useRouter } from "next/navigation"; // Added router for redirection

export interface User {
  id: string;
  name: string;
  email: string;
  type: string;
}

export interface CostHead {
  id: number;
  name: string;
  type: string;
  amount: number;
}

export interface Meal {
  id: number;
  userId: number;
  year: number;
  month: number;
  date: number;
  type: string;
  amount: number;
}

export interface BazarCost {
  id: number;
  userId: number;
  year: number;
  month: number;
  amount: number;
  status: string;
}

export interface BazarSlot {
  id: number;
  userId: number;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

export type AmountsType = Record<string, Record<string | number, number>>;

export default function MonthlyBillForm() {
  const router = useRouter(); // Initialize router
  const [users, setUsers] = useState<User[]>([]);
  const [costHeads, setCostHeads] = useState<CostHead[]>([]);
  const [customValues, setCustomValues] = useState<
    Record<string, Record<string, number>>
  >({});
  const [amounts, setAmounts] = useState<AmountsType>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false); // Track authorization status

  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(0);

  const [bazarCosts, setBazarCosts] = useState<BazarCost[]>([]);
  const [bazarTotal, setBazarTotal] = useState<number>(0);
  const [bazarLoading, setBazarLoading] = useState(false);
  const [userBazarAmounts, setUserBazarAmounts] = useState<
    Record<string, number>
  >({});
  const [bazarSlots, setBazarSlots] = useState<BazarSlot[]>([]);

  // --- NEW STATE FOR EMAIL SELECTION ---
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const toggleUserSelection = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === summaryData.userStats.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(summaryData.userStats.map((u) => String(u.id)));
    }
  };

  // Authorization and Date Initialization
  useEffect(() => {
    const info = localStorage.getItem("userInfo");
    const storedToken = localStorage.getItem("userToken");

    if (!storedToken || !info) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(info);
    if (userData.type !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const currentDate = new Date();
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonth(currentDate.getMonth() + 1);
    setToken(storedToken);
    setIsAuthorized(true);
  }, [router]);

  const palettes = [
    {
      bg: "bg-white dark:bg-gray-900",
      alt: "bg-blue-50/30 dark:bg-blue-900/10",
    },
    {
      bg: "bg-gray-50/50 dark:bg-gray-800/30",
      alt: "bg-gray-100/50 dark:bg-gray-800/50",
    },
  ];

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2024; year <= currentYear; year++) {
      years.push(year);
    }
    return years;
  }, []);

  const months = useMemo(() => {
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const date = new Date(selectedYear, i - 1, 1);
      const monthName = date.toLocaleString("default", { month: "long" });
      months.push({ value: i, name: monthName });
    }
    return months;
  }, [selectedYear]);

  const summaryData = useMemo(() => {
    const totalMeals = meals.reduce((sum, m) => sum + (m.amount || 0), 0);
    const globalMealRate = totalMeals > 0 ? bazarTotal / totalMeals : 0;

    const userStats = users.map((u) => {
      const userIdStr = String(u.id);
      const userTotalMeals = meals
        .filter((m) => String(m.userId) === userIdStr)
        .reduce((sum, m) => sum + (m.amount || 0), 0);

      const slot = bazarSlots.find((s) => String(s.userId) === userIdStr);
      let mealsInSlot = 0;
      let slotMealRate = 0;

      if (slot) {
        const totalMealsDuringSlot = meals
          .filter((m) => {
            const mealDate = m.date;
            return (
              mealDate >= Number(slot.startDate) &&
              mealDate <= Number(slot.endDate)
            );
          })
          .reduce((sum, m) => sum + (m.amount || 0), 0);

        const bazarDuringSlot = bazarCosts
          .filter((b) => String(b.userId) === userIdStr)
          .reduce((sum, b) => sum + (b.amount || 0), 0);

        slotMealRate =
          totalMealsDuringSlot > 0 ? bazarDuringSlot / totalMealsDuringSlot : 0;
        mealsInSlot = totalMealsDuringSlot;
      }

      return {
        ...u,
        userTotalMeals,
        bazarPaid: userBazarAmounts[userIdStr] || 0,
        mealCost: userTotalMeals * globalMealRate,
        slotMealRate,
        mealsInSlot,
        hasSlot: !!slot,
        slotRange: slot ? `${slot.startDate}-${slot.endDate}` : null,
      };
    });

    return { totalMeals, globalMealRate, userStats };
  }, [users, meals, bazarTotal, bazarSlots, bazarCosts, userBazarAmounts]);

  const fetchBazarCosts = useCallback(async () => {
    if (!token || !selectedYear || !selectedMonth) return;
    setBazarLoading(true);
    try {
      const response = await api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: {
          action: "getBazarCosts",
          token,
          year: selectedYear,
          month: selectedMonth,
          status: "active",
        },
      });
      const bazarData = Array.isArray(response.data) ? response.data : [];
      setBazarCosts(bazarData);
      const userAmounts: Record<string, number> = {};
      let total = 0;
      bazarData.forEach((item: BazarCost) => {
        const userId = String(item.userId);
        userAmounts[userId] = (userAmounts[userId] || 0) + (item.amount || 0);
        total += item.amount || 0;
      });
      setBazarTotal(total);
      setUserBazarAmounts(userAmounts);
    } catch (err) {
      setError("Failed to load bazar costs.");
    } finally {
      setBazarLoading(false);
    }
  }, [token, selectedYear, selectedMonth]);

  const fetchBazarSlots = useCallback(async () => {
    if (!token || !selectedYear || !selectedMonth) return;
    try {
      const response = await api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: {
          action: "getBazarSlots",
          token,
          year: selectedYear,
          month: selectedMonth,
        },
      });
      const slotsData = Array.isArray(response.data) ? response.data : [];
      setBazarSlots(slotsData);
    } catch (err) {
      console.error("Failed to load bazar slots.");
    }
  }, [token, selectedYear, selectedMonth]);

  useEffect(() => {
    if (isAuthorized) fetchBazarSlots();
  }, [fetchBazarSlots, isAuthorized]);

  useEffect(() => {
    if (isAuthorized) fetchBazarCosts();
  }, [fetchBazarCosts, isAuthorized]);

  useEffect(() => {
    if (!token || !isAuthorized) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersRes, headsRes] = await Promise.all([
          api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
            params: { action: "getUsers", token },
          }),
          api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
            params: { action: "getCostHeads", token },
          }),
        ]);
        const usersData = usersRes.data || [];
        const headsData = headsRes.data?.costHeads || [];
        setUsers(usersData);
        setCostHeads(headsData);
        setCustomValues(headsRes.data?.customValues || {});
        const initialAmounts: AmountsType = {};
        usersData.forEach((u: User) => {
          initialAmounts[u.id] = { meal: 0, bazar: 0 };
          headsData.forEach((c: CostHead) => {
            initialAmounts[u.id][c.id] = 0;
          });
        });
        setAmounts(initialAmounts);
      } catch (err) {
        setError("Failed to load initial data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, isAuthorized]);

  useEffect(() => {
    setAmounts((prev) => {
      const updated = { ...prev };
      Object.entries(userBazarAmounts).forEach(([userId, amount]) => {
        if (updated[userId]) updated[userId].bazar = amount;
      });
      return updated;
    });
  }, [userBazarAmounts]);

  useEffect(() => {
    setAmounts((prev) => {
      const reset = { ...prev };
      Object.keys(reset).forEach((id) => {
        if (reset[id]) reset[id].bazar = 0;
      });
      return reset;
    });
    setBazarTotal(0);
    setBazarCosts([]);
    setUserBazarAmounts({});
  }, [selectedYear, selectedMonth]);

  const fetchMeals = useCallback(async () => {
    if (bazarTotal <= 0) return alert("Bazar total is zero.");
    setLoading(true);
    try {
      const res = await api.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
        params: {
          action: "getMeals",
          token,
          year: selectedYear,
          month: selectedMonth,
        },
      });
      const mealsData = Array.isArray(res.data) ? res.data : [];
      setMeals(mealsData);
      let totalMeals = 0;
      const userMealTotals: Record<string, number> = {};
      mealsData.forEach((m) => {
        totalMeals += m.amount || 0;
        userMealTotals[m.userId] =
          (userMealTotals[m.userId] || 0) + (m.amount || 0);
      });
      const mealRate = totalMeals > 0 ? bazarTotal / totalMeals : 0;
      setAmounts((prev) => {
        const updated = { ...prev };
        users.forEach((u) => {
          const cost = parseFloat(
            ((userMealTotals[u.id] || 0) * mealRate).toFixed(2),
          );
          if (updated[u.id]) updated[u.id].meal = cost;
        });
        return updated;
      });
    } catch (err) {
      setError("Meal fetch failed.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedYear, selectedMonth, bazarTotal, users]);

  const handleChange = (
    userId: string,
    headId: number | string,
    value: string,
  ) => {
    const num = parseFloat(value) || 0;
    setAmounts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [headId]: num },
    }));
  };

  const distributeSmartly = (headId: number) => {
    const costHead = costHeads.find((c) => c.id === headId);
    if (!costHead) return;
    let remaining = costHead.amount;
    const noCustom: User[] = [];
    const distribution: Record<string, number> = {};
    users.forEach((u) => {
      const val = customValues[u.id]?.[String(headId)];
      if (val !== undefined) {
        distribution[u.id] = val;
        remaining -= val;
      } else noCustom.push(u);
    });
    if (noCustom.length > 0) {
      const perUser = parseFloat((remaining / noCustom.length).toFixed(2));
      noCustom.forEach((u) => {
        distribution[u.id] = perUser;
      });
    }
    setAmounts((prev) => {
      const updated = { ...prev };
      Object.entries(distribution).forEach(([uid, amt]) => {
        if (updated[uid]) updated[uid][headId] = amt;
      });
      return updated;
    });
  };

  const userTotal = (userId: string) => {
    const ams = amounts[userId];
    if (!ams) return 0;
    let sum = costHeads.reduce((acc, h) => acc + (ams[h.id] || 0), 0);
    return sum + (ams.meal || 0) - (ams.bazar || 0);
  };

  const headTotal = (headId: number | string) =>
    users.reduce((acc, u) => acc + (amounts[u.id]?.[headId] || 0), 0);
  const grandTotal = () => users.reduce((acc, u) => acc + userTotal(u.id), 0);

  const userMealCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    meals.forEach((m) => {
      counts[m.userId] = (counts[m.userId] || 0) + (m.amount || 0);
    });
    return counts;
  }, [meals]);

  if (!isAuthorized)
    return <Spinner isLoading={true} message="Verifying access..." />;

  if (error)
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-bold mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );

  const sendSummaryEmail = async () => {
    if (selectedUserIds.length === 0) {
      return alert("Please select members to notify.");
    }

    const confirmSend = confirm(
      `Send detailed bills to ${selectedUserIds.length} members?`,
    );
    if (!confirmSend) return;

    setLoading(true);
    const monthName =
      months.find((m) => m.value === selectedMonth)?.name || "Summary";
    const subject = `Bill Statement: ${monthName} ${selectedYear}`;

    // GAS এ পাঠানোর জন্য আমরা একটি Array of Objects তৈরি করছি
    const billData = selectedUserIds.map((id) => {
      const user = summaryData.userStats.find((u) => String(u.id) === id);
      const userAmounts = amounts[id] || {};
      const pTotal = userTotal(id);

      // ফিক্সড কস্ট বা অন্যান্য খরচগুলো অবজেক্ট হিসেবে নিচ্ছি
      const fixedCosts = {};
      costHeads.forEach((head) => {
        fixedCosts[head.name] = userAmounts[head.id] || 0;
      });

      return {
        userId: id,
        userName: user?.name || "Unknown",
        userEmail: user?.email || "",
        fixedCosts: fixedCosts,
        meals: user?.userTotalMeals || 0,
        mealCost: user?.mealCost || 0,
        bazarPaid: user?.bazarPaid || 0,
        netPayable: pTotal,
        month: monthName,
        year: selectedYear,
        hasSlot: user?.hasSlot || false,
        slotRange: user?.slotRange || "N/A",
        mealsInSlot: user?.mealsInSlot || 0,
        slotMealRate: user?.slotMealRate || 0,
      };
    });

    try {
      const payload = {
        subject: subject,
        totalMonthMeals: summaryData.totalMeals,
        totalMonthBazar: bazarTotal,
        globalMealRate: summaryData.globalMealRate,
        bills: billData, // এখন আমরা সরাসরি অবজেক্টের লিস্ট পাঠাচ্ছি
      };

      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));

      const res = await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=sendBulkNotifications&token=${token}`,
        formData,
      );

      if (res.data.success) {
        alert(`✅ Statements sent and archived in tabular format!`);
        setSelectedUserIds([]);
      } else {
        alert("❌ Error: " + res.data.error);
      }
    } catch (err) {
      alert("❌ Failed to send notifications.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-2 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-sm text-gray-900 dark:text-gray-100">
      <Spinner isLoading={loading} message="Processing Bill..." />
      <h1 className="text-2xl font-bold mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
        Monthly Bill Statement
      </h1>
      <div className="grid grid-cols-2 md:flex gap-4 mb-8 items-end border-b border-gray-200 dark:border-gray-700 pb-6">
        <div className="flex flex-col">
          <label className="text-xs font-bold mb-1 opacity-70">Year</label>
          <select
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 rounded outline-none"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            <option value="0">Select Year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-bold mb-1 opacity-70">Month</label>
          <select
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 rounded outline-none"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            <option value="0">Select Month</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-bold mb-1 opacity-70 flex justify-between">
            Bazar Total{" "}
            <button
              onClick={fetchBazarCosts}
              className="text-blue-500 hover:underline"
            >
              {bazarLoading ? "..." : "⟳ Refresh"}
            </button>
          </label>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-center font-bold text-green-600">
            {bazarTotal.toFixed(2)} Tk
          </div>
        </div>
        <button
          onClick={fetchMeals}
          disabled={loading || bazarTotal <= 0}
          className="col-span-2 md:col-auto bg-blue-600 text-white px-6 py-2 rounded font-bold shadow-md disabled:opacity-50"
        >
          Calculate Meal Cost
        </button>
      </div>
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="min-w-full text-center border-separate border-spacing-0">
          <thead className="sticky top-0 z-30">
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="sticky left-0 z-40 bg-gray-100 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 p-3 text-left font-bold min-w-[160px]">
                User Name
              </th>
              {costHeads.map((h) => (
                <th
                  key={h.id}
                  className="border-b border-r border-gray-200 dark:border-gray-700 p-3 min-w-[110px]"
                >
                  <div className="flex flex-col gap-1 items-center">
                    <span className="font-bold">{h.name}</span>
                    <button
                      onClick={() => distributeSmartly(h.id)}
                      className="text-[9px] bg-amber-400 dark:bg-amber-600 text-black dark:text-white px-2 py-0.5 rounded font-bold uppercase"
                    >
                      Generate
                    </button>
                  </div>
                </th>
              ))}
              <th className="border-b border-r border-gray-200 dark:border-gray-700 p-3 bg-green-50/50 dark:bg-green-900/20 text-green-600">
                Meal Cost
              </th>
              <th className="border-b border-r border-gray-200 dark:border-gray-700 p-3 bg-red-50/50 dark:bg-red-900/20 text-red-600">
                Bazar Paid
              </th>
              <th className="border-b border-gray-200 dark:border-gray-700 p-3 bg-blue-600 text-white">
                Personal Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {users.map((u, idx) => {
              const p = palettes[idx % 2];
              const total = userTotal(u.id);
              return (
                <tr
                  key={u.id}
                  className={`${p.bg} hover:bg-blue-50/40 dark:hover:bg-blue-900/10`}
                >
                  <td className="sticky left-0 z-20 border-b border-r border-gray-200 dark:border-gray-700 p-3 text-left bg-inherit shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                    <div className="font-bold">{u.name}</div>
                    {userMealCounts[u.id] > 0 && (
                      <div className="text-[10px] opacity-60">
                        {userMealCounts[u.id].toFixed(1)} meals
                      </div>
                    )}
                  </td>
                  {costHeads.map((c) => (
                    <td
                      key={c.id}
                      className="border-b border-r border-gray-200 dark:border-gray-700 p-1"
                    >
                      <input
                        type="number"
                        className="w-full bg-transparent text-right p-1 outline-none focus:ring-1 focus:ring-blue-400 rounded"
                        value={amounts[u.id]?.[c.id] ?? 0}
                        onChange={(e) =>
                          handleChange(u.id, c.id, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  <td className="border-b border-r border-gray-200 dark:border-gray-700 p-1 bg-green-50/20 dark:bg-green-900/5">
                    <input
                      type="number"
                      className="w-full bg-transparent text-right p-1 outline-none font-bold text-green-600"
                      value={amounts[u.id]?.meal ?? 0}
                      onChange={(e) =>
                        handleChange(u.id, "meal", e.target.value)
                      }
                    />
                  </td>
                  <td className="border-b border-r border-gray-200 dark:border-gray-700 p-3 text-right font-bold text-red-500">
                    {amounts[u.id]?.bazar?.toFixed(2) || "0.00"}
                  </td>
                  <td
                    className={`border-b border-gray-200 dark:border-gray-700 p-3 text-right font-black text-base ${total >= 0 ? "text-blue-600 dark:text-blue-400" : "text-green-600"}`}
                  >
                    {total.toFixed(2)}
                    {total < 0 && (
                      <div className="text-[10px] font-normal opacity-70">
                        (Refund)
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-30 bg-gray-100 dark:bg-gray-800 font-bold">
            <tr>
              <td className="sticky left-0 z-40 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 text-left">
                Head Totals
              </td>
              {costHeads.map((c) => (
                <td
                  key={c.id}
                  className="border-r border-gray-200 dark:border-gray-700 p-3 text-right"
                >
                  {headTotal(c.id).toFixed(2)}
                </td>
              ))}
              <td className="border-r border-gray-200 dark:border-gray-700 p-3 text-right text-green-600">
                {headTotal("meal").toFixed(2)}
              </td>
              <td className="border-r border-gray-200 dark:border-gray-700 p-3 text-right text-red-500">
                {headTotal("bazar").toFixed(2)}
              </td>
              <td className="p-3 text-right bg-blue-600 text-white text-lg">
                {grandTotal().toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <p className="text-xs font-bold uppercase opacity-60 mb-1">
            Total Expenses
          </p>
          <p className="text-2xl font-black text-blue-600">
            {(headTotal(costHeads[0]?.id || 0) + headTotal("meal")).toFixed(2)}{" "}
            Tk
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <p className="text-xs font-bold uppercase opacity-60 mb-1">
            Total Bazar
          </p>
          <p className="text-2xl font-black text-green-600">
            {bazarTotal.toFixed(2)} Tk
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <p className="text-xs font-bold uppercase opacity-60 mb-1">
            Net Balance
          </p>
          <p
            className={`text-2xl font-black ${grandTotal() >= 0 ? "text-blue-600" : "text-rose-600"}`}
          >
            {grandTotal().toFixed(2)} Tk
          </p>
        </div>
      </div>

      <div className="mt-10 mb-6">
        <button
          onClick={sendSummaryEmail}
          disabled={loading || selectedUserIds.length === 0}
          className="mb-5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          📧 Notify Selected ({selectedUserIds.length})
        </button>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          📊 Detailed Meal & Bazar Summary
        </h2>

        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left sticky top-0 z-30">
              <tr>
                {/* --- NEW CHECKBOX HEADER --- */}
                <th className="p-3 border-b border-r border-gray-200 dark:border-gray-700 text-center w-12 sticky left-0 z-40 bg-gray-50 dark:bg-gray-800">
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer"
                    onChange={toggleSelectAll}
                    checked={
                      selectedUserIds.length === summaryData.userStats.length &&
                      summaryData.userStats.length > 0
                    }
                  />
                </th>
                <th className="sticky left-[48px] z-40 bg-gray-50 dark:bg-gray-800 p-3 border-b border-r border-gray-200 dark:border-gray-700 font-bold min-w-[160px]">
                  Manager / User
                </th>
                <th className="p-3 border-b border-gray-200 dark:border-gray-700 text-center min-w-[100px]">
                  User Meals
                </th>
                <th className="p-3 border-b border-gray-200 dark:border-gray-700 text-center min-w-[120px]">
                  Slot Range
                </th>
                <th className="p-3 border-b border-gray-200 dark:border-gray-700 text-center min-w-[120px]">
                  Meals in Slot
                </th>
                <th className="p-3 border-b border-gray-200 dark:border-gray-700 text-center min-w-[110px]">
                  Bazar Paid
                </th>
                <th className="p-3 border-b border-gray-200 dark:border-gray-700 text-center min-w-[130px]">
                  Slot Meal Rate
                </th>
                <th className="p-3 border-b border-gray-200 dark:border-gray-700 text-right min-w-[120px]">
                  Total Meal Cost
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {summaryData.userStats.map((stat, idx) => {
                const isSelected = selectedUserIds.includes(String(stat.id));
                return (
                  <tr
                    key={stat.id}
                    className={`group hover:bg-blue-50/40 dark:hover:bg-blue-900/10 ${isSelected ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}
                  >
                    {/* --- NEW CHECKBOX CELL --- */}
                    <td className="p-3 text-center border-b border-r border-gray-100 dark:border-gray-800 sticky left-0 z-20 bg-inherit shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleUserSelection(String(stat.id))}
                      />
                    </td>
                    <td className="sticky left-[48px] z-20 p-3 bg-inherit border-b border-r border-gray-100 dark:border-gray-800 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] group-hover:bg-inherit">
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {stat.name}
                      </div>
                      {stat.hasSlot && (
                        <div className="text-[10px] text-orange-600 font-medium">
                          Active Slot Manager
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center border-b border-gray-100 dark:border-gray-800">
                      {stat.userTotalMeals.toFixed(1)}
                    </td>
                    <td className="p-3 text-center border-b border-gray-100 dark:border-gray-800">
                      {stat.slotRange ? (
                        <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-xs">
                          {stat.slotRange}
                        </span>
                      ) : (
                        <span className="opacity-30">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-semibold border-b border-gray-100 dark:border-gray-800">
                      {stat.mealsInSlot > 0 ? (
                        <span className="bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                          {stat.mealsInSlot.toFixed(1)}
                        </span>
                      ) : (
                        <span className="opacity-30">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-semibold text-red-500 border-b border-gray-100 dark:border-gray-800">
                      {stat.bazarPaid.toFixed(2)}
                    </td>
                    <td className="p-3 text-center border-b border-gray-100 dark:border-gray-800">
                      {stat.slotMealRate > 0 ? (
                        <span className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300">
                          {stat.slotMealRate.toFixed(2)} /meal
                        </span>
                      ) : (
                        <span className="opacity-30">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-green-600 border-b border-gray-100 dark:border-gray-800">
                      {stat.mealCost.toFixed(2)} Tk
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-gray-800/50 font-black sticky bottom-0 z-30">
              <tr>
                {/* --- ADJUSTED COLSPAN FOR FOOTER --- */}
                <td
                  colSpan={2}
                  className="sticky left-0 z-40 bg-gray-100 dark:bg-gray-800 p-3 border-r border-gray-200 dark:border-gray-700"
                >
                  GLOBAL TOTALS
                </td>
                <td className="p-3 text-center">
                  {summaryData.totalMeals.toFixed(1)}
                </td>
                <td className="p-3 text-center">—</td>
                <td className="p-3 text-center">
                  {summaryData.userStats
                    .reduce((sum, stat) => sum + stat.mealsInSlot, 0)
                    .toFixed(1)}
                </td>
                <td className="p-3 text-center text-red-600">
                  {bazarTotal.toFixed(2)}
                </td>
                <td className="p-3 text-center">
                  Avg: {summaryData.globalMealRate.toFixed(2)}
                </td>
                <td className="p-3 text-right text-green-700">
                  {(
                    summaryData.totalMeals * summaryData.globalMealRate
                  ).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
