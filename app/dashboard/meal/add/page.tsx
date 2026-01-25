"use client";

import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

export default function MealSheet() {
  const [users, setUsers] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [editedMeals, setEditedMeals] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;

  // মাসের দিন সংখ্যা জেনারেট করা
  const daysInMonth = useMemo(() => {
    const daysCount = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    if (!token) return;
    axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { 
      params: { action: "getUserList", token } 
    })
    .then(res => setUsers(Array.isArray(res.data) ? res.data : []))
    .catch(() => setError("Failed to fetch users."));
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
      console.log("Fetched meals test:", mealsData);
      
      // Log unique meal types to see what we're working with
      const uniqueTypes = [...new Set(mealsData.map(m => m.type))];
      console.log("Unique meal types in data:", uniqueTypes);
      
      setMeals(mealsData);
    } catch (err) {
      setError("ডেটা আনতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (userId: any, day: number, type: string, value: string) => {
    const key = `${userId}-${day}-${type.toLowerCase()}`;
    setEditedMeals(prev => ({ ...prev, [key]: value }));
  };

  // Helper function to get cell value with proper type mapping
  const getCellValue = (userId: number, day: number, mealType: string): string => {
    const key = `${userId}-${day}-${mealType.toLowerCase()}`;
    
    // 1. Check if user edited this cell
    if (editedMeals[key] !== undefined) {
      return editedMeals[key];
    }
    
    // 2. Find in fetched meals data
    const meal = meals.find(m => {
      // User ID match
      const userIdMatch = 
        String(m.userId).trim() === String(userId).trim() ||
        Number(m.userId) === Number(userId);
      
      // Date match
      const dateMatch = 
        String(m.date).trim() === String(day).trim() ||
        Number(m.date) === Number(day);
      
      // Month match
      const monthMatch = 
        String(m.month).trim() === String(selectedMonth).trim() ||
        Number(m.month) === Number(selectedMonth);
      
      // Meal type match - check both letter codes and full words
      const mealTypeLower = mealType.toLowerCase();
      const mTypeLower = String(m.type).toLowerCase();
      
      let typeMatch = false;
      
      // Map meal types: B/Breakfast, L/Lunch, D/Dinner
      if (mealTypeLower === 'breakfast' || mealTypeLower === 'b') {
        typeMatch = mTypeLower === 'b' || mTypeLower === 'breakfast';
      } else if (mealTypeLower === 'lunch' || mealTypeLower === 'l') {
        typeMatch = mTypeLower === 'l' || mTypeLower === 'lunch';
      } else if (mealTypeLower === 'dinner' || mealTypeLower === 'd') {
        typeMatch = mTypeLower === 'd' || mTypeLower === 'dinner';
      }
      
      return userIdMatch && dateMatch && monthMatch && typeMatch;
    });
    
    // If meal exists and has amount, return it as string, otherwise return empty string
    if (meal && meal.amount !== undefined && meal.amount !== null) {
      return String(meal.amount);
    }
    
    return "";
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 min-h-screen text-sm">
      
      {/* ফিল্টার সেকশন */}
      <div className="flex gap-4 mb-6 items-end border-b pb-4">
        <div>
          <label className="block text-xs font-bold mb-1">Year</label>
          <select className="border p-2 rounded text-black" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Month</label>
          <select className="border p-2 rounded text-black" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(selectedYear, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <button onClick={fetchMeals} className="bg-blue-600 text-white px-6 py-2 rounded font-bold shadow-md">
          {loading ? "Loading..." : "Filter & Call Data"}
        </button>
      </div>

      {/* Error display */}
      {error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>}

      {/* Data summary */}
      <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 text-xs rounded">
        <div className="font-bold mb-1">Data Summary (January 2026):</div>
        <div>• User 1, Date 1: B=0.5, D=1</div>
        <div>• User 1, Date 2: No data</div>
        <div>• User 2, Date 1: B=0.5</div>
        <div>• User 2, Date 2: D=1</div>
        <div className="mt-2 text-green-600 font-bold">
          Note: Database seems to use single letters (B, D) for meal types
        </div>
      </div>

      {/* টেবিল */}
      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="min-w-full text-center border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
            <tr>
              <th className="border p-2 min-w-[80px]">Date</th>
              {users.map(user => (
                <th key={user.id} className="border p-2 min-w-[150px] bg-blue-50 dark:bg-blue-900/20 text-black dark:text-white" colSpan={3}>
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
                  // Define meal types - use single letters to match database
                  const mealTypes = [
                    { key: "b", label: "B" },
                    { key: "l", label: "L" },
                    { key: "d", label: "D" }
                  ];
                  
                  return mealTypes.map(({ key, label }) => {
                    const value = getCellValue(user.id, day, key);
                    
                    // Debug for expected cells
                    if (
                      (user.id === 1 && day === 1 && key === "b") ||
                      (user.id === 1 && day === 1 && key === "d") ||
                      (user.id === 2 && day === 1 && key === "b") ||
                      (user.id === 2 && day === 2 && key === "d")
                    ) {
                      console.log(`Cell ${user.id}-${day}-${key}:`, value);
                    }
                    
                    return (
                      <td key={`${user.id}-${day}-${key}`} className="border p-0 w-12">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          className={`w-full h-10 text-center bg-transparent focus:bg-yellow-100 dark:focus:bg-yellow-900/30 outline-none ${
                            value ? "text-black dark:text-white font-medium bg-green-50/50 dark:bg-green-900/10" : "text-gray-400"
                          }`}
                          value={value}
                          onChange={(e) => handleInputChange(user.id, day, key, e.target.value)}
                          onFocus={(e) => e.target.select()}
                        />
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