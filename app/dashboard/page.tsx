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

export default function DashboardHome() {
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("userToken") : null;

  // Get current date details
  const now = new Date();
  const today = {
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) {
        window.location.href = "/login"; // Redirect if no token exists
        return;
      }

      setLoading(true);
      try {
        const [usersRes, mealsRes] = await Promise.all([
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
        ]);

        // If GAS returns an error specifically about the token
        if (
          usersRes.data.error === "Invalid token" ||
          mealsRes.data.error === "Invalid token"
        ) {
          handleLogout();
          return;
        }

        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        const allMeals = Array.isArray(mealsRes.data) ? mealsRes.data : [];
        setMeals(allMeals.filter((m) => Number(m.date) === today.day));
      } catch (err: any) {
        console.error("Dashboard load error:", err);
        // If the API status is 401 (Unauthorized), log out
        if (err.response?.status === 401) {
          handleLogout();
        }
      } finally {
        setLoading(false);
      }
    };

    const handleLogout = () => {
      localStorage.removeItem("userToken");
      localStorage.removeItem("userInfo");
      window.location.href = "/login"; // Force redirect to login page
    };

    fetchDashboardData();
  }, [token]);

  // Calculations for Today's Global Summary
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
      <Spinner isLoading={loading} message="Fetching today's stats..." />

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

      {/* --- Global Summary Cards --- */}
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

      {/* --- User-wise Breakdown --- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="font-bold">User Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase opacity-60 bg-gray-50 dark:bg-gray-900/40">
                <th className="p-4 border-b dark:border-gray-700">
                  Member Name
                </th>
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
                  User Total
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
                const userTotal = b + l + d;

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="p-4 border-b dark:border-gray-700 font-medium">
                      {user.name}
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
                      {userTotal > 0 ? (
                        userTotal
                      ) : (
                        <span className="opacity-30">0</span>
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

// Small helper component for the top cards
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
