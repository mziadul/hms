"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import Toaster, { type ToastType } from "@/components/Toaster";

export default function MealSheet() {
  const [users, setUsers] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [editedMeals, setEditedMeals] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<{
    [key: string]: "saving" | "saved" | "error";
  }>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1,
  );

  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  const token =
    typeof window !== "undefined" ? localStorage.getItem("userToken") : null;

  const palettes = [
    {
      header: "bg-blue-50 dark:bg-blue-900/30",
      body: "bg-white dark:bg-gray-900",
      text: "text-blue-600 dark:text-blue-400",
    },
    {
      header: "bg-gray-100 dark:bg-gray-800",
      body: "bg-gray-50/50 dark:bg-gray-800/30",
      text: "text-gray-600 dark:text-gray-400",
    },
  ];

  // Dynamic years array: 2024 থেকে current year পর্যন্ত
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);
  }, []);

  // Months array with names
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      name: new Date(selectedYear, i, 1).toLocaleString("default", {
        month: "long",
      }),
    }));
  }, [selectedYear]);

  // মাসের দিন সংখ্যা
  const daysInMonth = useMemo(() => {
    const daysCount = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  }, [selectedYear, selectedMonth]);

  // Initial Data Fetch on Mount
  useEffect(() => {
    const initializeData = async () => {
      if (!token) return;

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
              year: selectedYear,
              month: selectedMonth,
            },
          }),
        ]);

        const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
        const mealsData = Array.isArray(mealsRes.data) ? mealsRes.data : [];

        setUsers(usersData);
        setMeals(mealsData);
      } catch (err) {
        console.error("Initialization error:", err);
        setError("ডেটা লোড করতে সমস্যা হয়েছে।");
      } finally {
        setTimeout(() => {
          setLoading(false);
        }, 300);
      }
    };

    initializeData();
  }, [token]);

  const fetchMeals = async () => {
    if (!token) return;
    setLoading(true);
    setEditedMeals({});
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
    } catch (err) {
      setError("ডেটা আনতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // Debounced save function
  const [saveTrigger, setSaveTrigger] = useState<{
    userId: number;
    day: number;
    mealType: string;
    value: string;
  } | null>(null);

  const debouncedSaveTrigger = useDebounce(saveTrigger, 1000);

  useEffect(() => {
    if (debouncedSaveTrigger && token) {
      saveMealToAPI(
        debouncedSaveTrigger.userId,
        debouncedSaveTrigger.day,
        debouncedSaveTrigger.mealType,
        debouncedSaveTrigger.value,
      );
    }
  }, [debouncedSaveTrigger, token]);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, isVisible: true });
  };

  // Save meal to API
  const saveMealToAPI = useCallback(
    async (userId: number, day: number, mealType: string, amount: string) => {
      if (!token) {
        setError("Please login first");
        return false;
      }

      // if (!amount || parseFloat(amount) === 0) {
      //   const key = `${userId}-${day}-${mealType.toLowerCase()}`;
      //   setSaveStatus((prev) => ({ ...prev, [key]: "saved" }));
      //   return true;
      // }

      const key = `${userId}-${day}-${mealType.toLowerCase()}`;
      setSaveStatus((prev) => ({ ...prev, [key]: "saving" }));

      try {
        const numericAmount = amount === "" ? 0 : parseFloat(amount);

        const record = {
          userId: userId,
          year: selectedYear,
          month: selectedMonth,
          date: day,
          type: mealType.toUpperCase(),
          amount: amount === "" ? "" : numericAmount,
        };

        const response = await api.post(
          process.env.NEXT_PUBLIC_GAS_URL!,
          null,
          {
            params: {
              action: "updateMeals",
              token: token,
              records: JSON.stringify([record]),
            },
          },
        );

        if (response.data.success) {
          setSaveStatus((prev) => ({ ...prev, [key]: "saved" }));

          // Update local state
          setMeals((prev) => {
            const existingIndex = prev.findIndex(
              (m) =>
                String(m.userId).trim() === String(userId).trim() &&
                Number(m.date) === Number(day) &&
                Number(m.month) === Number(selectedMonth) &&
                Number(m.year) === Number(selectedYear) &&
                m.type.toUpperCase() === mealType.toUpperCase(),
            );

            if (amount === "" || amount === null) {
              if (existingIndex >= 0) {
                return prev.filter((_, i) => i !== existingIndex);
              }
              return prev;
            }

            const numericValue = parseFloat(amount);

            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                amount: numericValue,
              };
              return updated;
            } else {
              return [
                ...prev,
                {
                  id: Date.now(),
                  userId: userId,
                  year: selectedYear,
                  month: selectedMonth,
                  date: day,
                  type: mealType.toUpperCase(),
                  amount: numericValue,
                },
              ];
            }
          });

          showToast(`Meal saved for day ${day}`, "success");

          return true;
        } else {
          setSaveStatus((prev) => ({ ...prev, [key]: "error" }));
          setError(`Save failed: ${response.data.error || "Unknown error"}`);
          return false;
        }
      } catch (err: any) {
        setSaveStatus((prev) => ({ ...prev, [key]: "error" }));
        setError(`Save failed: ${err.message}`);
        return false;
      }
    },
    [token, selectedYear, selectedMonth],
  );

  const canUserEdit = (day: number, mealType: string) => {
    if (process.env.NEXT_PUBLIC_ALLOW_EDIT === "true") return true;

    const info =
      typeof window !== "undefined" ? localStorage.getItem("userInfo") : null;
    const userData = info ? JSON.parse(info) : null;
    const isAdmin = userData?.type === "admin";

    if (isAdmin) return true;

    const now = new Date();
    const today = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentHour = now.getHours();

    if (selectedYear > currentYear) return true;
    if (selectedYear === currentYear && selectedMonth > currentMonth)
      return true;
    if (
      selectedYear < currentYear ||
      (selectedYear === currentYear && selectedMonth < currentMonth)
    )
      return false;

    const type = mealType.toLowerCase();
    if (day > today) return true;

    if (day === today) {
      if (
        (type === "b" ||
          type === "breakfast" ||
          type === "l" ||
          type === "lunch") &&
        currentHour >= 6
      )
        return false;
      if ((type === "d" || type === "dinner") && currentHour >= 17)
        return false;
      return true;
    }

    return false;
  };

  // Handle input change
  const handleInputChange = (
    userId: number,
    day: number,
    mealType: string,
    value: string,
  ) => {
    if (!canUserEdit(day, mealType)) {
      showToast(
        "সময় পার হয়ে গেছে, আপনি এখন এটি পরিবর্তন করতে পারবেন না।",
        "error",
      );
      return;
    }

    const key = `${userId}-${day}-${mealType.toLowerCase()}`;

    setEditedMeals((prev) => ({ ...prev, [key]: value }));
    setActiveCell(key);

    setSaveTrigger({
      userId,
      day,
      mealType,
      value,
    });
  };

  // Handle onBlur
  const handleInputBlur = (
    userId: number,
    day: number,
    mealType: string,
    value: string,
  ) => {
    const key = `${userId}-${day}-${mealType.toLowerCase()}`;
    setActiveCell(null);

    // if (!value || parseFloat(value) === 0) {
    //   return;
    // }

    // setSaveTrigger({
    //   userId,
    //   day,
    //   mealType,
    //   value,
    // });
  };

  // Helper function to get cell value
  const getCellValue = (
    userId: number,
    day: number,
    mealType: string,
  ): string => {
    const key = `${userId}-${day}-${mealType.toLowerCase()}`;

    if (editedMeals[key] !== undefined) {
      return editedMeals[key];
    }

    const meal = meals.find((m) => {
      const userIdMatch =
        String(m.userId).trim() === String(userId).trim() ||
        Number(m.userId) === Number(userId);

      const dateMatch =
        String(m.date).trim() === String(day).trim() ||
        Number(m.date) === Number(day);

      const monthMatch =
        String(m.month).trim() === String(selectedMonth).trim() ||
        Number(m.month) === Number(selectedMonth);

      const mealTypeLower = mealType.toLowerCase();
      const mTypeLower = String(m.type).toLowerCase();

      let typeMatch = false;

      if (mealTypeLower === "breakfast" || mealTypeLower === "b") {
        typeMatch = mTypeLower === "b" || mTypeLower === "breakfast";
      } else if (mealTypeLower === "lunch" || mealTypeLower === "l") {
        typeMatch = mTypeLower === "l" || mTypeLower === "lunch";
      } else if (mealTypeLower === "dinner" || mealTypeLower === "d") {
        typeMatch = mTypeLower === "d" || mTypeLower === "dinner";
      }

      return userIdMatch && dateMatch && monthMatch && typeMatch;
    });

    if (meal && meal.amount !== undefined && meal.amount !== null) {
      return String(meal.amount);
    }

    return "";
  };

  return (
    <div className="p-2 md:p-4 bg-white dark:bg-gray-900 min-h-screen text-sm text-gray-900 dark:text-gray-100">
      <Spinner isLoading={loading} message="Processing Request..." />

      {/* ফিল্টার সেকশন - Responsive Grid */}
      <div className="grid grid-cols-2 md:flex gap-4 mb-6 items-end border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex flex-col">
          <label className="block text-xs font-bold mb-1 opacity-70">
            Year
          </label>
          <select
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="block text-xs font-bold mb-1 opacity-70">
            Month
          </label>
          <select
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchMeals}
          className="col-span-2 md:col-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold shadow-md transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Loading..." : "Filter & Load Meal"}
        </button>
      </div>

      {/* Status Indicators */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
        <div className="flex flex-wrap items-center gap-4 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="opacity-80">Saving</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
            <span className="opacity-80">Saved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
            <span className="opacity-80">Error</span>
          </div>
        </div>
        {activeCell && (
          <div className="text-blue-500 font-medium">
            ⚡ Editing: {activeCell}
          </div>
        )}
        {error && <div className="text-red-600 font-bold">{error}</div>}
      </div>

      {/* টেবিল কন্টেইনার */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm max-h-[75vh]">
        <table className="min-w-full text-center border-separate border-spacing-0">
          <thead className="sticky top-0 z-30">
            <tr>
              {/* Sticky Top-Left Corner Header */}
              <th
                rowSpan={2}
                className="sticky top-0 left-0 z-40 bg-gray-100 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 p-2 min-w-[90px] font-bold"
              >
                Date
              </th>
              {users.map((user, idx) => {
                const p = palettes[idx % 2];
                return (
                  <th
                    key={user.id}
                    className={`border-b border-r border-gray-200 dark:border-gray-700 p-2 min-w-[140px] bg-blue-50/80 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 font-bold ${p.header}`}
                    colSpan={3}
                  >
                    {user.name}
                  </th>
                );
              })}
              <th
                rowSpan={2}
                className="sticky right-0 z-40 bg-gray-100 dark:bg-gray-800 border-b border-l border-gray-200 dark:border-gray-700 p-2 min-w-[80px] font-black text-[10px] shadow-[-1px_0_0_0_rgba(0,0,0,0.1)]"
              >
                Day Total
              </th>
            </tr>
            <tr className="bg-gray-50 dark:bg-gray-800 text-[10px] font-bold sticky top-[37px] z-30">
              {users.map((user, idx) => {
                const p = palettes[idx % 2];
                return (
                  <React.Fragment key={`sub-${user.id}`}>
                    <th
                      className={`border-b border-r border-gray-200 dark:border-gray-700 p-1 text-blue-600 dark:text-blue-400 ${p.header}`}
                    >
                      B
                    </th>
                    <th
                      className={`border-b border-r border-gray-200 dark:border-gray-700 p-1 text-green-600 dark:text-green-400 ${p.header}`}
                    >
                      L
                    </th>
                    <th
                      className={`border-b border-r border-gray-200 dark:border-gray-700 p-1 text-red-600 dark:text-red-400 ${p.header}`}
                    >
                      D
                    </th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>

          <tbody className="bg-white dark:bg-gray-900">
            {daysInMonth.map((day) => (
              <tr
                key={day}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* Sticky Date Column (Locked to left) */}
                <td className="sticky left-0 z-20 border-b border-r border-gray-200 dark:border-gray-700 p-2 font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
                  {day < 10 ? `0${day}` : day}/
                  {selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth}
                </td>

                {users.map((user, idx) => {
                  const mealTypes = ["b", "l", "d"];
                  return mealTypes.map((key) => {
                    const value = getCellValue(user.id, day, key);
                    const cellKey = `${user.id}-${day}-${key}`;
                    const status = saveStatus[cellKey];
                    const isActive = activeCell === cellKey;

                    const p = palettes[idx % 2];

                    return (
                      <td
                        key={cellKey}
                        className={`border-b border-r border-gray-200 dark:border-gray-700 p-0 w-12 relative ${p.header}`}
                      >
                        <input
                          type="number"
                          step="0.5"
                          inputMode="decimal"
                          disabled={!canUserEdit(day, key)}
                          className={`w-full h-10 text-center bg-transparent outline-none transition-all 
                            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                            ${value ? "text-gray-900 dark:text-white font-bold" : "text-gray-400 dark:text-gray-500"}
                            ${isActive ? "bg-blue-100 dark:bg-blue-900/60 ring-1 ring-inset ring-blue-500" : ""}
                            focus:bg-blue-50 dark:focus:bg-blue-900/40
                            ${
                              !canUserEdit(day, key)
                                ? "!bg-gray-400/15 dark:!bg-black/60 cursor-not-allowed !text-gray-600 dark:!text-gray-500 opacity-100 shadow-inner"
                                : "focus:bg-blue-50 dark:focus:bg-blue-900/40"
                            }
                            `}
                          value={value}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                              e.preventDefault();
                            }
                          }}
                          onTouchMove={(e) =>
                            (e.target as HTMLInputElement).blur()
                          }
                          onChange={(e) =>
                            handleInputChange(user.id, day, key, e.target.value)
                          }
                          onBlur={(e) =>
                            handleInputBlur(user.id, day, key, e.target.value)
                          }
                          onFocus={(e) => {
                            e.target.select();
                            setActiveCell(cellKey);
                          }}
                        />
                        {/* Status Indicator Dot */}
                        {status && (
                          <div className="absolute top-1 right-1 pointer-events-none">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                status === "saving"
                                  ? "bg-blue-500 animate-pulse"
                                  : status === "saved"
                                    ? "bg-green-500"
                                    : "bg-red-500"
                              }`}
                            />
                          </div>
                        )}
                      </td>
                    );
                  });
                })}
                <td className="sticky right-0 z-20 border-b border-l border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">
                  {(() => {
                    const dayMeals = meals.filter(
                      (m) => Number(m.date) === Number(day),
                    );

                    const b = dayMeals
                      .filter((m) => m.type.toLowerCase().startsWith("b"))
                      .reduce((s, m) => s + (Number(m.amount) || 0), 0);
                    const l = dayMeals
                      .filter((m) => m.type.toLowerCase().startsWith("l"))
                      .reduce((s, m) => s + (Number(m.amount) || 0), 0);
                    const d = dayMeals
                      .filter((m) => m.type.toLowerCase().startsWith("d"))
                      .reduce((s, m) => s + (Number(m.amount) || 0), 0);
                    const total = b + l + d;

                    if (total === 0)
                      return <span className="text-gray-400">-</span>;

                    return (
                      <div className="flex flex-col leading-tight text-[10px]">
                        <div className="flex justify-between px-1">
                          <span className="text-blue-600">B:{b}</span>
                          <span className="text-green-600">L:{l}</span>
                          <span className="text-red-600">D:{d}</span>
                        </div>
                        <div className="mt-1 border-t border-gray-300 dark:border-gray-600 font-black text-sm text-gray-900 dark:text-white">
                          {total}
                        </div>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Footer for Totals */}
          <tfoot className="sticky bottom-0 z-30 bg-gray-100 dark:bg-gray-800 font-bold shadow-[0_-2px_5px_rgba(0,0,0,0.1)]">
            {/* Row 1: Individual Meal Totals (B, L, D) */}
            <tr>
              <td className="sticky left-0 z-40 bg-gray-200 dark:bg-gray-700 border-t border-r border-gray-300 dark:border-gray-600 p-2 text-[10px] uppercase">
                Meal Totals
              </td>
              {users.map((user) => {
                const mealTypes = ["breakfast", "lunch", "dinner"];
                return mealTypes.map((type) => {
                  const total = meals
                    .filter(
                      (m) =>
                        Number(m.userId) === Number(user.id) &&
                        m.type.toLowerCase().startsWith(type[0]),
                    )
                    .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

                  return (
                    <td
                      key={`total-${user.id}-${type}`}
                      className="border-t border-r border-gray-300 dark:border-gray-600 p-2 text-blue-700 dark:text-blue-400"
                    >
                      {total > 0 ? total : "-"}
                    </td>
                  );
                });
              })}
            </tr>

            {/* Row 2: Grand Total Per User */}
            <tr className="bg-blue-100 dark:bg-blue-900/60">
              <td className="sticky left-0 z-40 bg-blue-200 dark:bg-blue-800 border-t border-r border-gray-300 dark:border-gray-600 p-2 text-[10px] uppercase font-black text-blue-900 dark:text-blue-100">
                Grand Total
              </td>
              {users.map((user) => {
                const grandTotal = meals
                  .filter((m) => Number(m.userId) === Number(user.id))
                  .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

                return (
                  <td
                    key={`grand-${user.id}`}
                    colSpan={3}
                    className="border-t border-r border-gray-300 dark:border-gray-600 p-2 text-base font-black text-blue-900 dark:text-blue-100"
                  >
                    {grandTotal > 0 ? grandTotal : "-"}
                  </td>
                );
              })}
              <td className="sticky right-0 z-40 bg-blue-200 dark:bg-blue-800 border-t border-l border-gray-300 dark:border-gray-600 p-2 text-base font-black text-blue-900 dark:text-blue-100 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)]">
                {meals.reduce((sum, m) => sum + (Number(m.amount) || 0), 0) ||
                  "-"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Toaster
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
}

// useDebounce hook (separate file or same file)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
