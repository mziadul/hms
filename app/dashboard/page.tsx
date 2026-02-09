"use client";

import React, { useEffect, useState, useMemo } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";

interface MealRecord {
  id: number | string;
  userId: number | string;
  type: string;
  amount: number;
  date: number;
  month: number;
  year: number;
}

interface User {
  id: number | string;
  name: string;
}

interface ArchiveRecord {
  "User ID": string | number;
  "Net Payable": number;
  "Paid Status": string;
  "Paid Amount": number;
  Month: string;
  Year: number | string;
}

export default function DashboardHome() {
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [archiveData, setArchiveData] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("userToken") : null;

  const now = new Date();
  const today = {
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };

  // --- গত মাসের হিসাব বের করা ---
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthInfo = {
    monthName: prevDate.toLocaleString("default", { month: "long" }),
    year: prevDate.getFullYear(),
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      setLoading(true);
      try {
        const [usersRes, mealsRes, archiveRes] = await Promise.all([
          api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
            params: { action: "getUsers", token },
          }),
          api.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
            params: {
              action: "getMeals",
              token,
              year: today.year,
              month: today.month,
            },
          }),
          // আর্কাইভ এপিআই কল
          api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
            params: {
              action: "getMonthlyArchive",
              token,
              year: previousMonthInfo.year,
              month: previousMonthInfo.monthName,
            },
          }),
        ]);

        if (
          usersRes.data.error === "Invalid token" ||
          mealsRes.data.error === "Invalid token"
        ) {
          handleLogout();
          return;
        }

        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        const allMeals = Array.isArray(mealsRes.data) ? mealsRes.data : [];
        setMeals(
          allMeals.filter((m: MealRecord) => Number(m.date) === today.day),
        );
        setArchiveData(Array.isArray(archiveRes.data) ? archiveRes.data : []);
      } catch (err: any) {
        console.error("Dashboard load error:", err);
        if (err.response?.status === 401) handleLogout();
      } finally {
        setLoading(false);
      }
    };

    const handleLogout = () => {
      localStorage.removeItem("userToken");
      localStorage.removeItem("userInfo");
      window.location.href = "/login";
    };

    fetchDashboardData();
  }, [token]);

  const globalSummary = useMemo(() => {
    const stats = { B: 0, L: 0, D: 0, total: 0 };
    meals.forEach((m) => {
      const type = m.type.toLowerCase();
      const amt = Number(m.amount) || 0;
      if (type.startsWith("b")) stats.B += amt;
      else if (type.startsWith("l")) stats.L += amt;
      else if (type.startsWith("d")) stats.D += amt;
      stats.total += amt;
    });
    return stats;
  }, [meals]);

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <Spinner isLoading={loading} message="Fetching dashboard stats..." />

      <header className="mb-8">
        <h1 className="text-2xl font-bold">Today's Meal Overview</h1>
        <p className="opacity-70">
          {now.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>

      {/* কার্ড সামারি */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Breakfast (B)"
          value={globalSummary.B}
          color="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Lunch (L)"
          value={globalSummary.L}
          color="text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Dinner (D)"
          value={globalSummary.D}
          color="text-red-600 dark:text-red-400"
        />
        <StatCard
          label="Grand Total"
          value={globalSummary.total}
          color="text-gray-900 dark:text-white"
          isBold
        />
      </div>

      {/* ইউজার ব্রেকডাউন টেবিল */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="font-bold">Member Wise Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase opacity-60 bg-gray-50 dark:bg-gray-900/40">
                <th className="p-4 border-b dark:border-gray-700">Name</th>
                <th className="p-4 border-b dark:border-gray-700 text-center">
                  B
                </th>
                <th className="p-4 border-b dark:border-gray-700 text-center">
                  L
                </th>
                <th className="p-4 border-b dark:border-gray-700 text-center">
                  D
                </th>
                <th className="p-4 border-b dark:border-gray-700 text-right">
                  Today Total
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const userMeals = meals.filter(
                  (m) => String(m.userId) === String(user.id),
                );
                const b = userMeals
                  .filter((m) => m.type.toLowerCase().startsWith("b"))
                  .reduce((s, m) => s + Number(m.amount), 0);
                const l = userMeals
                  .filter((m) => m.type.toLowerCase().startsWith("l"))
                  .reduce((s, m) => s + Number(m.amount), 0);
                const d = userMeals
                  .filter((m) => m.type.toLowerCase().startsWith("d"))
                  .reduce((s, m) => s + Number(m.amount), 0);

                const userPrevRecord = archiveData.find(
                  (a) => String(a["User ID"]) === String(user.id),
                );
                const due = userPrevRecord
                  ? Math.round(
                      Number(userPrevRecord["Net Payable"]) -
                        Number(userPrevRecord["Paid Amount"]),
                    )
                  : 0;

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="p-4 border-b dark:border-gray-700">
                      <div className="font-medium">{user.name}</div>
                      {userPrevRecord && (
                        <div
                          className={`text-[10px] font-bold uppercase mt-0.5 ${due <= 0 ? "text-green-500" : "text-orange-500"}`}
                        >
                          {previousMonthInfo.monthName}:{" "}
                          {due <= 0 ? "CLEARED" : `DUE: ${due} Tk`}
                        </div>
                      )}
                    </td>
                    <td className="p-4 border-b dark:border-gray-700 text-center text-blue-500 font-semibold">
                      {b || "-"}
                    </td>
                    <td className="p-4 border-b dark:border-gray-700 text-center text-green-500 font-semibold">
                      {l || "-"}
                    </td>
                    <td className="p-4 border-b dark:border-gray-700 text-center text-red-500 font-semibold">
                      {d || "-"}
                    </td>
                    <td className="p-4 border-b dark:border-gray-700 text-right font-black">
                      {b + l + d || <span className="opacity-30">0</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* বকেয়া লিস্ট সেকশন */}
      {archiveData.some(
        (a) =>
          Math.round(Number(a["Net Payable"]) - Number(a["Paid Amount"])) > 0,
      ) && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl p-4">
          <h3 className="text-orange-800 dark:text-orange-400 font-bold mb-3 flex items-center gap-2">
            ⚠️ Previous Month Dues ({previousMonthInfo.monthName}{" "}
            {previousMonthInfo.year})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archiveData.map((record, i) => {
              const due = Math.round(
                Number(record["Net Payable"]) - Number(record["Paid Amount"]),
              );
              if (due <= 0) return null;

              return (
                <div
                  key={i}
                  className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-orange-100 dark:border-orange-900/20"
                >
                  <span className="text-xs font-bold">
                    {
                      users.find(
                        (u) => String(u.id) === String(record["User ID"]),
                      )?.name
                    }
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-black text-orange-600">
                      {due} Tk
                    </span>
                    <p className="text-[9px] opacity-50">
                      Paid: {Math.round(Number(record["Paid Amount"]))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  isBold = false,
}: {
  label: string;
  value: number;
  color: string;
  isBold?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <p className="text-xs font-bold opacity-60 uppercase mb-1">{label}</p>
      <p className={`text-2xl ${isBold ? "font-black" : "font-bold"} ${color}`}>
        {value}
      </p>
    </div>
  );
}
