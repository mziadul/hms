"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface User {
  id: string;
  name: string;
  email: string;
  type: string;
}

interface CostHead {
  id: number;
  name: string;
  type: string;
  amount: number;
}

interface Meal {
  id: number;
  userId: number;
  year: number;
  month: number;
  date: number;
  type: string;
  amount: number;
}

// Amounts type definition
type AmountsType = Record<string, Record<string | number, number>>;

export default function MonthlyBillForm() {
  const [users, setUsers] = useState<User[]>([]);
  const [costHeads, setCostHeads] = useState<CostHead[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, Record<string, number>>>({});
  const [amounts, setAmounts] = useState<AmountsType>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  
  // Meal related states
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealCosts, setMealCosts] = useState<Record<string, number>>({});
  const [mealLoading, setMealLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(0);
  
  // Bazar total from environment
  const bazarTotal = process.env.NEXT_PUBLIC_BAZAR_TOTAL ? 
    parseFloat(process.env.NEXT_PUBLIC_BAZAR_TOTAL) : 0;

  // Initialize current month and year
  useEffect(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userToken = localStorage.getItem("userToken");
      setToken(userToken);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [usersRes, headsRes] = await Promise.all([
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { params: { action: "getUserList", token } }),
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { params: { action: "getCostHeads", token } }),
        ]);

        // User list
        const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
        setUsers(usersData);

        // Cost heads data
        const headsData = headsRes.data?.costHeads || [];
        const customs = headsRes.data?.customValues || {};

        setCostHeads(headsData);
        setCustomValues(customs);

        // Initialize input grid (default 0) - Use AmountsType
        const initialAmounts: AmountsType = {};
        usersData.forEach((u) => {
          initialAmounts[u.id] = {};
          headsData.forEach((c: CostHead) => {
            initialAmounts[u.id][c.id] = 0;
          });
          // Meal cost initial value - 'meal' is a string key
          initialAmounts[u.id]['meal'] = 0;
        });
        setAmounts(initialAmounts);
        
        // Initial meal costs
        const initialMealCosts: Record<string, number> = {};
        usersData.forEach(u => {
          initialMealCosts[u.id] = 0;
        });
        setMealCosts(initialMealCosts);
        
      } catch (err: any) {
        setError("Failed to load data. Please check API connection.");
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Fetch meals data
  const fetchMeals = async () => {
    if (!token) return;
    if (!selectedYear || !selectedMonth) {
      alert("Please select year and month first");
      return;
    }
    
    setMealLoading(true);
    try {
      const res = await axios.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
        params: { action: "getMeals", token, year: selectedYear, month: selectedMonth },
      });
      
      const mealsData = Array.isArray(res.data) ? res.data : [];
      console.log("Fetched meals data:", mealsData);
      setMeals(mealsData);
      
      // Calculate meal costs
      calculateMealCosts(mealsData);
      
    } catch (err) {
      setError("Failed to fetch meal data.");
      console.error("Error fetching meals:", err);
    } finally {
      setMealLoading(false);
    }
  };

  // Calculate meal costs
  const calculateMealCosts = (mealsData: Meal[]) => {
    if (mealsData.length === 0) {
      alert("No meal data found for selected month!");
      return;
    }
    
    if (bazarTotal <= 0) {
      alert("Bazar total not set! Please set NEXT_PUBLIC_BAZAR_TOTAL in .env file.");
      return;
    }
    
    // 1. Calculate total meals
    const totalMeals = mealsData.reduce((sum, meal) => sum + meal.amount, 0);
    console.log("Total meals:", totalMeals);
    
    // 2. Calculate meal rate
    const mealRate = bazarTotal / totalMeals;
    console.log("Meal rate:", mealRate, "Bazar total:", bazarTotal);
    
    // 3. Calculate each user's total meals
    const userMealTotals: Record<string, number> = {};
    mealsData.forEach(meal => {
      const userId = String(meal.userId);
      userMealTotals[userId] = (userMealTotals[userId] || 0) + meal.amount;
    });
    
    console.log("User meal totals:", userMealTotals);
    
    // 4. Calculate each user's meal cost
    const newMealCosts: Record<string, number> = {};
    const newAmounts = { ...amounts };
    
    users.forEach(user => {
      const userTotalMeals = userMealTotals[user.id] || 0;
      const userMealCost = userTotalMeals * mealRate;
      newMealCosts[user.id] = parseFloat(userMealCost.toFixed(2));
      
      // Update amounts state
      if (newAmounts[user.id]) {
        newAmounts[user.id]['meal'] = parseFloat(userMealCost.toFixed(2));
      }
    });
    
    setMealCosts(newMealCosts);
    setAmounts(newAmounts);
    
    // Show summary
    alert(`Meal cost calculation completed!\n\nTotal meals: ${totalMeals}\nMeal rate: ${mealRate.toFixed(2)} Tk\nBazar total: ${bazarTotal} Tk`);
  };

  // Manual input handler
  const handleChange = (userId: string, headId: number | string, value: string) => {
    const num = parseFloat(value) || 0;
    setAmounts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [headId]: num },
    }));
    
    // If it's meal cost column, update mealCosts state too
    if (headId === 'meal') {
      setMealCosts(prev => ({
        ...prev,
        [userId]: num
      }));
    }
  };

  // Smart distribution logic
  const distributeSmartly = (headId: number) => {
    const costHead = costHeads.find((c) => c.id === headId);
    if (!costHead || costHead.amount === 0) return alert("This cost head has zero amount");

    let totalAmountToSplit = costHead.amount;
    let usersWithoutCustom: User[] = [];
    const newHeadAmounts: Record<string, number> = {};

    // 1. Deduct custom/fixed values first
    users.forEach((u) => {
      const customVal = customValues[u.id]?.[String(headId)];
      if (customVal !== undefined) {
        newHeadAmounts[u.id] = customVal;
        totalAmountToSplit -= customVal;
      } else {
        usersWithoutCustom.push(u);
      }
    });

    // 2. Split remaining amount among others
    if (usersWithoutCustom.length > 0) {
      const perUser = parseFloat((totalAmountToSplit / usersWithoutCustom.length).toFixed(2));
      usersWithoutCustom.forEach((u) => {
        newHeadAmounts[u.id] = perUser;
      });
    }

    // 3. Update state
    setAmounts((prev) => {
      const updated = { ...prev };
      users.forEach((u) => {
        if (!updated[u.id]) updated[u.id] = {};
        updated[u.id][headId] = newHeadAmounts[u.id] || 0;
      });
      return updated;
    });
  };

  // Calculation functions
  const userTotal = (userId: string) => {
    let total = 0;
    
    // Add cost heads
    costHeads.forEach(c => {
      total += amounts[userId]?.[c.id] || 0;
    });
    
    // Add meal cost
    total += amounts[userId]?.['meal'] || 0;
    
    return total;
  };

  const headTotal = (headId: number) => 
    users.reduce((sum, u) => sum + (amounts[u.id]?.[headId] || 0), 0);

  const mealColumnTotal = () => 
    users.reduce((sum, u) => sum + (amounts[u.id]?.['meal'] || 0), 0);

  const grandTotal = () => 
    users.reduce((sum, u) => sum + userTotal(u.id), 0);

  // Generate years array from 2024 to current year
  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2024; year <= currentYear; year++) {
      years.push(year);
    }
    return years;
  };

  // Generate months array 1-12 with names
  const generateMonths = () => {
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const date = new Date(selectedYear, i - 1, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      months.push({ value: i, name: monthName });
    }
    return months;
  };

  if (loading) return <p className="p-6 text-blue-600 font-bold">Loading...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Monthly Bill Statement</h1>

      {/* Month/Year Selection and Meal Cost Button */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">Year</label>
            <select 
              className="border p-2 rounded text-black w-full md:w-32"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              <option value="0">Select Year</option>
              {generateYears().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-bold mb-1">Month</label>
            <select 
              className="border p-2 rounded text-black w-full md:w-40"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              <option value="0">Select Month</option>
              {generateMonths().map(month => (
                <option key={month.value} value={month.value}>{month.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-bold mb-1">Total Bazar Amount</label>
            <div className="p-2 bg-white border rounded text-center font-bold text-green-700">
              {bazarTotal.toFixed(2)} Tk
            </div>
          </div>
          
          <button
            onClick={fetchMeals}
            disabled={mealLoading || selectedYear === 0 || selectedMonth === 0}
            className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 
                     text-white px-6 py-2 rounded font-bold shadow-md transition-all h-fit
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mealLoading ? "Loading..." : "Calculate Meal Cost"}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto border rounded-xl shadow-lg">
        <table className="min-w-full border-collapse bg-white text-sm">
          <thead>
            <tr className="bg-purple-700 text-white">
              <th className="px-4 py-3 border border-purple-600 text-left">User Name</th>
              {costHeads.map((head) => (
                <th key={head.id} className="px-4 py-3 border border-purple-600">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">{head.name}</span>
                    <button
                      className="mt-2 text-[10px] bg-yellow-400 hover:bg-yellow-500 text-black px-2 py-1 rounded font-bold uppercase tracking-tighter transition-colors"
                      onClick={() => distributeSmartly(head.id)}
                    >
                      Generate
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 border border-purple-600">
                <div className="flex flex-col items-center">
                  <span className="font-semibold">Meal Cost</span>
                  <div className="mt-2 text-[10px] bg-green-400 text-black px-2 py-1 rounded font-bold">
                    Meal Based
                  </div>
                </div>
              </th>
              <th className="px-4 py-3 border border-purple-600 bg-purple-800 text-base">Personal Total</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-purple-50 transition-colors border-b">
                <td className="px-4 py-2 font-medium text-gray-700 bg-gray-50 border">
                  <div>{u.name}</div>
                  {meals.length > 0 && (
                    <div className="text-xs text-gray-500">
                      {meals.filter(m => 
                        Number(m.userId) === Number(u.id)
                      ).reduce((sum, meal) => sum + meal.amount, 0).toFixed(1)} meals
                    </div>
                  )}
                </td>
                {costHeads.map((c) => (
                  <td key={c.id} className="px-2 py-1 border">
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-right 
                                focus:outline-none focus:ring-2 focus:ring-purple-400 
                                text-gray-900 
                                bg-white"
                      value={amounts[u.id]?.[c.id] ?? 0}
                      onChange={(e) => handleChange(u.id, c.id, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-2 py-1 border bg-green-50">
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-2 py-1 border border-green-300 rounded text-right 
                              focus:outline-none focus:ring-2 focus:ring-green-400 
                              text-gray-900 font-bold
                              bg-green-50"
                    value={amounts[u.id]?.['meal'] ?? 0}
                    onChange={(e) => handleChange(u.id, 'meal', e.target.value)}
                  />
                </td>
                <td className="px-4 py-2 font-bold text-right text-purple-700 bg-gray-50 border">
                  {userTotal(u.id).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="bg-green-600 text-white font-bold">
            <tr>
              <td className="px-4 py-3 border border-green-500">Head Total</td>
              {costHeads.map((c) => (
                <td key={c.id} className="px-4 py-3 border border-green-500 text-right">
                  {headTotal(c.id).toFixed(2)}
                </td>
              ))}
              <td className="px-4 py-3 border border-green-500 text-right bg-green-700">
                {mealColumnTotal().toFixed(2)}
              </td>
              <td className="px-4 py-3 border border-green-500 text-right text-yellow-200 text-lg">
                {grandTotal().toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}