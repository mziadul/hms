"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import Spinner from "@/components/Spinner";

export default function MealSheet() {
  const [users, setUsers] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [editedMeals, setEditedMeals] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: "saving" | "saved" | "error" }>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;

  // Dynamic years array: 2024 থেকে current year পর্যন্ত
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from(
      { length: currentYear - 2023 }, 
      (_, i) => 2024 + i
    );
  }, []);

  // Months array with names
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      name: new Date(selectedYear, i, 1).toLocaleString('default', { month: 'long' })
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
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { 
            params: { action: "getUsers", token } 
          }),
          axios.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
            params: { action: "getMeals", token, year: selectedYear, month: selectedMonth },
          })
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
      const res = await axios.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
        params: { action: "getMeals", token, year: selectedYear, month: selectedMonth },
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

  const debouncedSaveTrigger = useDebounce(saveTrigger, 1500);

  useEffect(() => {
    if (debouncedSaveTrigger && token) {
      saveMealToAPI(
        debouncedSaveTrigger.userId,
        debouncedSaveTrigger.day,
        debouncedSaveTrigger.mealType,
        debouncedSaveTrigger.value
      );
    }
  }, [debouncedSaveTrigger, token]);

  // Save meal to API
  const saveMealToAPI = useCallback(async (
    userId: number, 
    day: number, 
    mealType: string, 
    amount: string
  ) => {
    if (!token) {
      setError("Please login first");
      return false;
    }

    if (!amount || parseFloat(amount) === 0) {
      const key = `${userId}-${day}-${mealType.toLowerCase()}`;
      setSaveStatus(prev => ({ ...prev, [key]: "saved" }));
      return true;
    }

    const key = `${userId}-${day}-${mealType.toLowerCase()}`;
    setSaveStatus(prev => ({ ...prev, [key]: "saving" }));

    try {
      const record = {
        userId: userId,
        year: selectedYear,
        month: selectedMonth,
        date: day,
        type: mealType.toUpperCase(),
        amount: parseFloat(amount)
      };

      const response = await axios.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
        params: {
          action: "updateMeals",
          token: token,
          records: JSON.stringify([record])
        }
      });

      if (response.data.success) {
        setSaveStatus(prev => ({ ...prev, [key]: "saved" }));
        
        // Update local state
        setMeals(prev => {
          const existingIndex = prev.findIndex(m => 
            m.userId === userId && 
            m.year === selectedYear && 
            m.month === selectedMonth && 
            m.date === day && 
            m.type === mealType.toUpperCase()
          );
          
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { 
              ...updated[existingIndex], 
              amount: parseFloat(amount) 
            };
            return updated;
          } else {
            return [...prev, {
              id: prev.length + 1,
              userId,
              year: selectedYear,
              month: selectedMonth,
              date: day,
              type: mealType.toUpperCase(),
              amount: parseFloat(amount)
            }];
          }
        });
        
        return true;
      } else {
        setSaveStatus(prev => ({ ...prev, [key]: "error" }));
        setError(`Save failed: ${response.data.error || 'Unknown error'}`);
        return false;
      }
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, [key]: "error" }));
      setError(`Save failed: ${err.message}`);
      return false;
    }
  }, [token, selectedYear, selectedMonth]);

  // Handle input change
  const handleInputChange = (
    userId: number, 
    day: number, 
    mealType: string, 
    value: string
  ) => {
    const key = `${userId}-${day}-${mealType.toLowerCase()}`;
    
    setEditedMeals(prev => ({ ...prev, [key]: value }));
    setActiveCell(key);
    
    setSaveTrigger({
      userId,
      day,
      mealType,
      value
    });
  };

  // Handle onBlur
  const handleInputBlur = (
    userId: number, 
    day: number, 
    mealType: string, 
    value: string
  ) => {
    const key = `${userId}-${day}-${mealType.toLowerCase()}`;
    setActiveCell(null);
    
    if (!value || parseFloat(value) === 0) {
      return;
    }
    
    setSaveTrigger({
      userId,
      day,
      mealType,
      value
    });
  };

  // Helper function to get cell value
  const getCellValue = (userId: number, day: number, mealType: string): string => {
    const key = `${userId}-${day}-${mealType.toLowerCase()}`;
    
    if (editedMeals[key] !== undefined) {
      return editedMeals[key];
    }
    
    const meal = meals.find(m => {
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
      
      if (mealTypeLower === 'breakfast' || mealTypeLower === 'b') {
        typeMatch = mTypeLower === 'b' || mTypeLower === 'breakfast';
      } else if (mealTypeLower === 'lunch' || mealTypeLower === 'l') {
        typeMatch = mTypeLower === 'l' || mTypeLower === 'lunch';
      } else if (mealTypeLower === 'dinner' || mealTypeLower === 'd') {
        typeMatch = mTypeLower === 'd' || mTypeLower === 'dinner';
      }
      
      return userIdMatch && dateMatch && monthMatch && typeMatch;
    });
    
    if (meal && meal.amount !== undefined && meal.amount !== null) {
      return String(meal.amount);
    }
    
    return "";
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 min-h-screen text-sm">
      <Spinner isLoading={loading} message="Processing Request..." />
      {/* ফিল্টার সেকশন */}
      <div className="flex gap-4 mb-6 items-end border-b pb-4">
        <div>
          <label className="block text-xs font-bold mb-1">Year</label>
          <select 
            className="border p-2 rounded" 
            value={selectedYear} 
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            <option value="0">Select Year</option>
            {years.map(year => 
              <option key={year} value={year}>{year}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Month</label>
          <select 
            className="border p-2 rounded" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(Number(e.target.value))}
          >
            <option value="0">Select Month</option>
            {months.map(month => (
              <option key={month.value} value={month.value}>
                {month.name}
              </option>
            ))}
          </select>
        </div>
        <button 
          onClick={fetchMeals} 
          className="bg-blue-600 text-white px-6 py-2 rounded font-bold shadow-md"
          disabled={loading}
        >
          {loading ? "Loading..." : "Filter & Load Data"}
        </button>
      </div>

      {/* Status indicators */}
      <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Saving (auto-save in 1.5s)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Saved to Google Sheets</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Error - Click to retry</span>
          </div>
        </div>
        {activeCell && (
          <div className="text-blue-600">
            ⚡ Editing cell: {activeCell}
          </div>
        )}
        {error && <div className="text-red-600">{error}</div>}
      </div>

      {/* টেবিল */}
      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="min-w-full text-center border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
            <tr>
              <th className="border p-2 min-w-[80px]">Date</th>
              {users.map(user => (
                <th 
                  key={user.id} 
                  className="border p-2 min-w-[150px] bg-blue-50 dark:bg-blue-900/20 text-black dark:text-white" 
                  colSpan={3}
                >
                  {user.name}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 dark:bg-gray-800 text-[10px] font-bold">
              <th className="border"></th>
              {users.map(user => (
                <React.Fragment key={`sub-${user.id}`}>
                  <th className="border p-1 text-blue-600">B</th>
                  <th className="border p-1 text-green-600">L</th>
                  <th className="border p-1 text-red-600">D</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {daysInMonth.map(day => (
              <tr key={day} className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b">
                {/* তারিখের কলাম */}
                <td className="border p-2 font-bold bg-gray-50 dark:bg-gray-800 text-black dark:text-white">
                  {day < 10 ? `0${day}` : day}-{selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth}
                </td>

                {/* প্রতি ইউজারের জন্য ৩টি সেল (B, L, D) */}
                {users.map(user => {
                  const mealTypes = [
                    { key: "b", label: "B" },
                    { key: "l", label: "L" },
                    { key: "d", label: "D" }
                  ];
                  
                  return mealTypes.map(({ key, label }) => {
                    const value = getCellValue(user.id, day, key);
                    const cellKey = `${user.id}-${day}-${key}`;
                    const status = saveStatus[cellKey];
                    const isActive = activeCell === cellKey;
                    
                    return (
                      <td 
                        key={cellKey} 
                        className="border p-0 w-12 relative"
                      >
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            className={`w-full h-10 text-center bg-transparent focus:bg-yellow-100 dark:focus:bg-yellow-900/30 outline-none ${
                              value ? "text-black dark:text-white font-medium" : "text-gray-400"
                            } ${isActive ? 'ring-2 ring-blue-500' : ''}`}
                            value={value}
                            onChange={(e) => handleInputChange(user.id, day, key, e.target.value)}
                            onBlur={(e) => handleInputBlur(user.id, day, key, e.target.value)}
                            onFocus={(e) => {
                              e.target.select();
                              setActiveCell(cellKey);
                            }}
                          />
                          
                          {/* Status indicator */}
                          {status && (
                            <div className="absolute top-1 right-1" title={status}>
                              {status === "saving" && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              )}
                              {status === "saved" && (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              )}
                              {status === "error" && (
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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