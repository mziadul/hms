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

  const distributeAllHeads = () => {
    costHeads.forEach((head) => {
      distributeSmartly(head.id);
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
      return alert("দয়া করে মেম্বার সিলেক্ট করুন।");
    }

    const confirmSend = confirm(
      `${selectedUserIds.length} জন মেম্বারকে বিল পাঠাতে চান?`,
    );
    if (!confirmSend) return;

    setLoading(true);

    try {
      const payload = {
        year: selectedYear,
        month: months.find((m) => m.value === selectedMonth)?.name || "",
        userIds: selectedUserIds,
        subject: `বিলের বিবরণ: ${selectedMonth}/${selectedYear}`,
      };

      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));

      const res = await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=sendBulkNotifications&token=${token}`,
        formData,
      );

      if (res.data.success) {
        alert(`✅ ${res.data.message}`);
        setSelectedUserIds([]);
      } else {
        alert("❌ এরর: " + res.data.error);
      }
    } catch (err) {
      alert("❌ ইমেইল পাঠাতে ব্যর্থ হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // --- পরিবর্তন ২: শুধুমাত্র ডেটা সেভ/আর্কাইভ করার মেথড (syncMonthlyData) ---
  const syncMonthlyData = async () => {
    const confirmSync = confirm(
      "আপনি কি এই মাসের পুরো ডেটা শিটে সেভ/আর্কাইভ করতে চান?",
    );
    if (!confirmSync) return;

    setLoading(true);
    const monthName =
      months.find((m) => m.value === selectedMonth)?.name || "Summary";

    const billData = users.map((u) => {
      const id = String(u.id);
      const user = summaryData.userStats.find((s) => String(s.id) === id);
      const userAmounts = amounts[id] || {};

      const fixedCosts: Record<string, number> = {};
      costHeads.forEach((head) => {
        fixedCosts[head.name] = (userAmounts[head.id] as number) || 0;
      });

      return {
        userId: id,
        userName: u.name,
        year: selectedYear,
        month: monthName,
        fixedCosts: fixedCosts,
        meals: user?.userTotalMeals || 0,
        mealCost: user?.mealCost || 0,
        bazarPaid: user?.bazarPaid || 0,
        netPayable: userTotal(id),
        hasSlot: user?.hasSlot || false,
        slotRange: user?.slotRange || "-",
        mealsInSlot: user?.mealsInSlot || 0,
        slotMealRate: user?.slotMealRate || 0,
      };
    });

    try {
      const payload = {
        totalMonthMeals: summaryData.totalMeals,
        totalMonthBazar: bazarTotal,
        globalMealRate: summaryData.globalMealRate,
        bills: billData,
      };

      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));

      // এখানে অ্যাকশন নাম 'syncMonthlyData' ব্যবহার করা হয়েছে
      const res = await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=syncMonthlyData&token=${token}`,
        formData,
      );

      if (res.data.success) {
        alert(`✅ ${res.data.message}`);
      } else {
        alert("❌ এরর: " + res.data.error);
      }
    } catch (err) {
      alert("❌ ডেটা সিঙ্ক করতে ব্যর্থ হয়েছে।");
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
        <div>
          <button
            onClick={distributeAllHeads}
            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded font-bold shadow-md transition-all active:scale-95"
          >
            Distribute Cost
          </button>
        </div>
        <button
          onClick={fetchMeals}
          disabled={loading || bazarTotal <= 0}
          className="col-span-2 md:col-auto bg-blue-600 text-white px-6 py-2 rounded font-bold shadow-md disabled:opacity-50"
        >
          Calculate Meal Cost
        </button>
      </div>

      {/* New Eye-catching Summary Cards for Global Stats */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Meals Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-white/10 backdrop-blur-3xl"></div>
          <div className="absolute bottom-0 left-0 h-20 w-20 -translate-x-6 translate-y-6 rounded-full bg-white/10 backdrop-blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-blue-100">
                  Total Meals
                </p>
                <p className="mt-2 text-4xl font-black">
                  {summaryData.totalMeals.toFixed(1)}
                </p>
              </div>
              <div className="rounded-full bg-white/20 p-3 backdrop-blur-3xl">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  ></path>
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-blue-100">
              <span className="mr-2">🍽️ Total meals consumed</span>
            </div>
          </div>
        </div>

        {/* Total Bazar Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-white/10 backdrop-blur-3xl"></div>
          <div className="absolute bottom-0 left-0 h-20 w-20 -translate-x-6 translate-y-6 rounded-full bg-white/10 backdrop-blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-green-100">
                  Total Bazar
                </p>
                <p className="mt-2 text-4xl font-black">
                  {bazarTotal.toFixed(2)}
                </p>
                <p className="text-sm opacity-90">Taka</p>
              </div>
              <div className="rounded-full bg-white/20 p-3 backdrop-blur-3xl">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-green-100">
              <span className="mr-2">🛒 Total grocery expenses</span>
            </div>
          </div>
        </div>

        {/* Meal Rate Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-white/10 backdrop-blur-3xl"></div>
          <div className="absolute bottom-0 left-0 h-20 w-20 -translate-x-6 translate-y-6 rounded-full bg-white/10 backdrop-blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-purple-100">
                  Meal Rate
                </p>
                <p className="mt-2 text-4xl font-black">
                  {summaryData.globalMealRate.toFixed(2)}
                </p>
                <p className="text-sm opacity-90">Tk/meal</p>
              </div>
              <div className="rounded-full bg-white/20 p-3 backdrop-blur-3xl">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  ></path>
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-purple-100">
              <span className="mr-2">
                📊 {bazarTotal.toFixed(2)} Tk /{" "}
                {summaryData.totalMeals.toFixed(1)} meals
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 items-center justify-end">
        <button
          onClick={sendSummaryEmail}
          disabled={loading || selectedUserIds.length === 0}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          📧 Notify Selected ({selectedUserIds.length})
        </button>

        <button
          onClick={syncMonthlyData}
          disabled={loading || summaryData.totalMeals === 0}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          📁 Sync to Archive
        </button>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="min-w-full text-center border-separate border-spacing-0">
          <thead className="sticky top-0 z-30">
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="sticky left-0 z-40 bg-gray-100 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 p-3 text-left font-bold min-w-[160px]">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer"
                    onChange={toggleSelectAll}
                    checked={
                      selectedUserIds.length === summaryData.userStats.length &&
                      summaryData.userStats.length > 0
                    }
                  />
                  <span>User Name</span>
                </div>
              </th>
              {costHeads.map((h) => (
                <th
                  key={h.id}
                  className="border-b border-r border-gray-200 dark:border-gray-700 p-3 min-w-[110px]"
                >
                  <div className="flex flex-col gap-1 items-center">
                    <span className="font-bold">{h.name}</span>
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
              {/* New summary columns */}
              <th className="border-b border-gray-200 dark:border-gray-700 p-3 min-w-[100px]">
                User Meals
              </th>
              <th className="border-b border-gray-200 dark:border-gray-700 p-3 min-w-[120px]">
                Slot Range
              </th>
              <th className="border-b border-gray-200 dark:border-gray-700 p-3 min-w-[120px]">
                Meals in Slot
              </th>
              <th className="border-b border-gray-200 dark:border-gray-700 p-3 min-w-[130px]">
                Slot Meal Rate
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {users.map((u, idx) => {
              const p = palettes[idx % 2];
              const total = userTotal(u.id);
              const stat = summaryData.userStats.find(
                (s) => String(s.id) === String(u.id),
              );
              const isSelected = selectedUserIds.includes(String(u.id));

              return (
                <tr
                  key={u.id}
                  className={`${p.bg} ${isSelected ? "bg-blue-50/30 dark:bg-blue-900/10" : ""} hover:bg-blue-50/40 dark:hover:bg-blue-900/10`}
                >
                  <td className="sticky left-0 z-20 border-b border-r border-gray-200 dark:border-gray-700 p-3 text-left bg-inherit shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleUserSelection(String(u.id))}
                      />
                      <div>
                        <div className="font-bold">{u.name}</div>
                        {userMealCounts[u.id] > 0 && (
                          <div className="text-[10px] opacity-60">
                            {userMealCounts[u.id].toFixed(1)} meals
                          </div>
                        )}
                      </div>
                    </div>
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
                    className={`border-b border-r border-gray-200 dark:border-gray-700 p-3 text-right font-black text-base ${total >= 0 ? "text-blue-600 dark:text-blue-400" : "text-green-600"}`}
                  >
                    {total.toFixed(2)}
                    {total < 0 && (
                      <div className="text-[10px] font-normal opacity-70">
                        (Refund)
                      </div>
                    )}
                  </td>
                  {/* New summary data cells */}
                  <td className="border-b border-r border-gray-200 dark:border-gray-700 p-3 text-center">
                    {stat?.userTotalMeals.toFixed(1) || "0.0"}
                  </td>
                  <td className="border-b border-r border-gray-200 dark:border-gray-700 p-3 text-center">
                    {stat?.slotRange ? (
                      <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-xs">
                        {stat.slotRange}
                      </span>
                    ) : (
                      <span className="opacity-30">—</span>
                    )}
                  </td>
                  <td className="border-b border-r border-gray-200 dark:border-gray-700 p-3 text-center font-semibold">
                    {stat?.mealsInSlot && stat.mealsInSlot > 0 ? (
                      <span className="bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                        {stat.mealsInSlot.toFixed(1)}
                      </span>
                    ) : (
                      <span className="opacity-30">—</span>
                    )}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-700 p-3 text-center">
                    {stat?.slotMealRate && stat.slotMealRate > 0 ? (
                      <span className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300">
                        {stat.slotMealRate.toFixed(2)} /meal
                      </span>
                    ) : (
                      <span className="opacity-30">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-30 bg-gray-100 dark:bg-gray-800 font-bold">
            <tr>
              <td className="sticky left-0 z-40 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 text-left">
                Totals
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
              <td className="border-r border-gray-200 dark:border-gray-700 p-3 text-right bg-blue-600 text-white">
                {grandTotal().toFixed(2)}
              </td>
              {/* Footer for new summary columns */}
              <td className="border-r border-gray-200 dark:border-gray-700 p-3 text-center">
                {summaryData.totalMeals.toFixed(1)}
              </td>
              <td className="border-r border-gray-200 dark:border-gray-700 p-3 text-center">
                —
              </td>
              <td className="border-r border-gray-200 dark:border-gray-700 p-3 text-center">
                {summaryData.userStats
                  .reduce((sum, stat) => sum + stat.mealsInSlot, 0)
                  .toFixed(1)}
              </td>
              <td className="p-3 text-center">
                Avg: {summaryData.globalMealRate.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bottom Summary Cards */}
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
    </div>
  );
}
