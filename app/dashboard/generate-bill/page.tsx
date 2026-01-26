"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import Spinner from "@/components/Spinner";

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

export type AmountsType = Record<string, Record<string | number, number>>;

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
  
  // Bazar cost related states
  const [bazarCosts, setBazarCosts] = useState<BazarCost[]>([]);
  const [bazarTotal, setBazarTotal] = useState<number>(0);
  const [bazarLoading, setBazarLoading] = useState(false);
  
  // User-wise bazar amounts
  const [userBazarAmounts, setUserBazarAmounts] = useState<Record<string, number>>({});

  // Memoized calculations
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
      const monthName = date.toLocaleString('default', { month: 'long' });
      months.push({ value: i, name: monthName });
    }
    return months;
  }, [selectedYear]);

  // Initialize current month and year - optimized
  useEffect(() => {
    const currentDate = new Date();
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonth(currentDate.getMonth() + 1);
  }, []);

  useEffect(() => {
    const userToken = localStorage.getItem("userToken");
    setToken(userToken);
  }, []);

  // Fetch bazar costs - optimized with useCallback
  const fetchBazarCosts = useCallback(async () => {
    if (!token || !selectedYear || !selectedMonth) return;
    
    setBazarLoading(true);
    try {
      const params = {
        action: "getBazarCosts",
        token: token!,
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
        status: "active"
      };

      const response = await axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { params });
      
      if (response.data?.error) {
        console.error("Error from GAS:", response.data.error);
        setBazarTotal(0);
        setBazarCosts([]);
        setUserBazarAmounts({});
        return;
      }
      
      const bazarData = Array.isArray(response.data) ? response.data : [];
      setBazarCosts(bazarData);
      
      // Calculate totals in one pass
      const userAmounts: Record<string, number> = {};
      let total = 0;
      
      bazarData.forEach((item: BazarCost) => {
        const userId = String(item.userId);
        const amount = item.amount || 0;
        
        userAmounts[userId] = (userAmounts[userId] || 0) + amount;
        total += amount;
      });
      
      setBazarTotal(total);
      setUserBazarAmounts(userAmounts);
      
    } catch (err: any) {
      console.error("Error fetching bazar costs:", err.response?.data || err.message);
      
      if (err.response?.data?.error === "Invalid action") {
        setError("getBazarCosts action not found. Please add the function to your GAS script.");
      } else {
        setError("Failed to load bazar costs.");
      }
      
      setBazarTotal(0);
      setBazarCosts([]);
      setUserBazarAmounts({});
    } finally {
      setBazarLoading(false);
    }
  }, [token, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchBazarCosts();
  }, [fetchBazarCosts]);

  // Initial data fetch - optimized
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [usersRes, headsRes] = await Promise.all([
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { 
            params: { action: "getUsers", token } 
          }),
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { 
            params: { action: "getCostHeads", token } 
          }),
        ]);

        const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
        const headsData = headsRes.data?.costHeads || [];
        const customs = headsRes.data?.customValues || {};

        setUsers(usersData);
        setCostHeads(headsData);
        setCustomValues(customs);

        // Initialize amounts efficiently
        const initialAmounts: AmountsType = {};
        const initialMealCosts: Record<string, number> = {};
        
        usersData.forEach((u) => {
          initialAmounts[u.id] = {};
          initialMealCosts[u.id] = 0;
          
          // Initialize cost heads
          headsData.forEach((c: CostHead) => {
            initialAmounts[u.id][c.id] = 0;
          });
          
          // Initialize meal and bazar
          initialAmounts[u.id]['meal'] = 0;
          initialAmounts[u.id]['bazar'] = 0;
        });
        
        setAmounts(initialAmounts);
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

  // Update amounts when userBazarAmounts changes - optimized
  useEffect(() => {
    if (Object.keys(userBazarAmounts).length === 0) return;
    
    setAmounts(prev => {
      const updated = { ...prev };
      Object.entries(userBazarAmounts).forEach(([userId, amount]) => {
        if (updated[userId]) {
          updated[userId] = { ...updated[userId], bazar: amount };
        }
      });
      return updated;
    });
  }, [userBazarAmounts]);

  // Fetch meals data - optimized
  const fetchMeals = useCallback(async () => {
    if (!token || !selectedYear || !selectedMonth) {
      alert("Please select year and month first");
      return;
    }
    
    if (bazarTotal <= 0) {
      alert("No bazar costs found for selected month or total amount is zero!");
      return;
    }
    
    setMealLoading(true);
    try {
      const res = await axios.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
        params: { 
          action: "getMeals", 
          token, 
          year: selectedYear, 
          month: selectedMonth 
        },
      });
      
      const mealsData = Array.isArray(res.data) ? res.data : [];
      setMeals(mealsData);
      
      // Calculate meal costs
      if (mealsData.length === 0) {
        alert("No meal data found for selected month!");
        return;
      }
      
      // Calculate in one efficient pass
      const userMealTotals: Record<string, number> = {};
      let totalMeals = 0;
      
      mealsData.forEach(meal => {
        const amount = meal.amount || 0;
        const userId = String(meal.userId);
        
        userMealTotals[userId] = (userMealTotals[userId] || 0) + amount;
        totalMeals += amount;
      });
      
      if (totalMeals === 0) {
        alert("Total meals count is zero!");
        return;
      }
      
      const mealRate = bazarTotal / totalMeals;
      const newMealCosts: Record<string, number> = {};
      
      // Update states in batch
      setAmounts(prev => {
        const updated = { ...prev };
        users.forEach(user => {
          const userTotalMeals = userMealTotals[user.id] || 0;
          const userMealCost = parseFloat((userTotalMeals * mealRate).toFixed(2));
          
          newMealCosts[user.id] = userMealCost;
          
          if (updated[user.id]) {
            updated[user.id] = { ...updated[user.id], meal: userMealCost };
          }
        });
        return updated;
      });
      
      setMealCosts(newMealCosts);
      
    } catch (err) {
      setError("Failed to fetch meal data.");
      console.error("Error fetching meals:", err);
    } finally {
      setMealLoading(false);
    }
  }, [token, selectedYear, selectedMonth, bazarTotal, bazarCosts.length, users]);

  // Manual input handler - optimized
  const handleChange = useCallback((userId: string, headId: number | string, value: string) => {
    const num = parseFloat(value) || 0;
    
    setAmounts(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [headId]: num },
    }));
    
    if (headId === 'meal') {
      setMealCosts(prev => ({
        ...prev,
        [userId]: num
      }));
    }
  }, []);

  // Smart distribution logic - optimized
  const distributeSmartly = useCallback((headId: number) => {
    const costHead = costHeads.find((c) => c.id === headId);
    if (!costHead || costHead.amount === 0) {
      alert("This cost head has zero amount");
      return;
    }

    let totalAmountToSplit = costHead.amount;
    const usersWithoutCustom: User[] = [];
    const newHeadAmounts: Record<string, number> = {};

    // First pass: collect custom values
    users.forEach((u) => {
      const customVal = customValues[u.id]?.[String(headId)];
      if (customVal !== undefined) {
        newHeadAmounts[u.id] = customVal;
        totalAmountToSplit -= customVal;
      } else {
        usersWithoutCustom.push(u);
      }
    });

    // Second pass: distribute remaining
    if (usersWithoutCustom.length > 0) {
      const perUser = parseFloat((totalAmountToSplit / usersWithoutCustom.length).toFixed(2));
      usersWithoutCustom.forEach((u) => {
        newHeadAmounts[u.id] = perUser;
      });
    }

    // Update state in one batch
    setAmounts(prev => {
      const updated = { ...prev };
      Object.entries(newHeadAmounts).forEach(([userId, amount]) => {
        if (updated[userId]) {
          updated[userId] = { ...updated[userId], [headId]: amount };
        }
      });
      return updated;
    });
  }, [costHeads, customValues, users]);

  // Memoized calculation functions
  const userTotal = useCallback((userId: string) => {
    const userAmounts = amounts[userId];
    if (!userAmounts) return 0;
    
    let total = 0;
    
    // Sum cost heads
    for (let i = 0; i < costHeads.length; i++) {
      total += userAmounts[costHeads[i].id] || 0;
    }
    
    // Add meal cost, subtract bazar
    total += (userAmounts['meal'] || 0) - (userAmounts['bazar'] || 0);
    
    return total;
  }, [amounts, costHeads]);

  const headTotal = useCallback((headId: number) => {
    let sum = 0;
    for (let i = 0; i < users.length; i++) {
      sum += amounts[users[i].id]?.[headId] || 0;
    }
    return sum;
  }, [amounts, users]);

  const mealColumnTotal = useCallback(() => {
    let sum = 0;
    for (let i = 0; i < users.length; i++) {
      sum += amounts[users[i].id]?.['meal'] || 0;
    }
    return sum;
  }, [amounts, users]);

  const bazarColumnTotal = useCallback(() => {
    let sum = 0;
    for (let i = 0; i < users.length; i++) {
      sum += amounts[users[i].id]?.['bazar'] || 0;
    }
    return sum;
  }, [amounts, users]);

  const grandTotal = useCallback(() => {
    let sum = 0;
    for (let i = 0; i < users.length; i++) {
      sum += userTotal(users[i].id);
    }
    return sum;
  }, [users, userTotal]);

  // Memoized meal count per user
  const userMealCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (meals.length === 0) return counts;
    
    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i];
      const userId = String(meal.userId);
      counts[userId] = (counts[userId] || 0) + (meal.amount || 0);
    }
    
    return counts;
  }, [meals]);

  // Refresh bazar costs button
  const handleRefreshBazar = () => {
    fetchBazarCosts();
  };

  if (error) return (
    <div className="p-6">
      <p className="text-red-600 mb-4">{error}</p>
      <button 
        onClick={() => window.location.reload()}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Retry
      </button>
    </div>
  );

  return (
    <div className="p-6">
      <Spinner isLoading={loading} message="Processing Request..." />
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
              {years.map(year => (
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
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-bold mb-1">
              Total Bazar Amount
              <button
                onClick={handleRefreshBazar}
                disabled={bazarLoading}
                className="ml-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded"
              >
                {bazarLoading ? "Loading..." : "⟳ Refresh"}
              </button>
            </label>
            <div className="p-2 bg-white border rounded text-center font-bold text-green-700">
              {bazarTotal.toFixed(2)} Tk
              <div className="text-xs text-gray-600 mt-1">
                {bazarCosts.length} records | Year: {selectedYear} | Month: {selectedMonth}
              </div>
            </div>
          </div>
          
          <button
            onClick={fetchMeals}
            disabled={mealLoading || selectedYear === 0 || selectedMonth === 0 || bazarTotal <= 0}
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
              <th className="px-4 py-3 border border-purple-600">
                <div className="flex flex-col items-center">
                  <span className="font-semibold">Bazar Paid</span>
                  <div className="mt-2 text-[10px] bg-red-400 text-black px-2 py-1 rounded font-bold">
                    Deduct
                  </div>
                </div>
              </th>
              <th className="px-4 py-3 border border-purple-600 bg-purple-800 text-base">
                <div className="flex flex-col items-center">
                  <span>Personal Total</span>
                  <div className="text-xs font-normal">(After Bazar Deduction)</div>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-purple-50 transition-colors border-b">
                <td className="px-4 py-2 font-medium text-gray-700 bg-gray-50 border">
                  <div>{u.name}</div>
                  {meals.length > 0 && userMealCounts[u.id] && (
                    <div className="text-xs text-gray-500">
                      {userMealCounts[u.id].toFixed(1)} meals
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
                                text-gray-900 bg-white"
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
                              text-gray-900 font-bold bg-green-50"
                    value={amounts[u.id]?.['meal'] ?? 0}
                    onChange={(e) => handleChange(u.id, 'meal', e.target.value)}
                  />
                </td>
                <td className="px-2 py-1 border bg-red-50">
                  <div className="w-full px-2 py-1 text-right font-bold text-red-700">
                    {amounts[u.id]?.['bazar']?.toFixed(2) || "0.00"}
                    <div className="text-xs text-gray-600">
                      (Auto from BazarCost)
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-2 font-bold text-right bg-gray-50 border ${
                  userTotal(u.id) >= 0 ? 'text-purple-700' : 'text-green-600'
                }`}>
                  {userTotal(u.id).toFixed(2)}
                  {userTotal(u.id) < 0 && (
                    <div className="text-xs text-green-600 font-normal">
                      (Will receive money)
                    </div>
                  )}
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
              <td className="px-4 py-3 border border-green-500 text-right bg-red-600">
                {bazarColumnTotal().toFixed(2)}
              </td>
              <td className="px-4 py-3 border border-green-500 text-right text-yellow-200 text-lg">
                {grandTotal().toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary Section */}
      <div className="mt-6 p-4 bg-gray-50 border rounded-lg">
        <h3 className="font-bold text-lg mb-3">Financial Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-white border rounded">
            <div className="text-sm text-gray-600">Total Expenses</div>
            <div className="text-xl font-bold text-blue-700">
              {(headTotal(costHeads[0]?.id || 0) + mealColumnTotal()).toFixed(2)} Tk
            </div>
            <div className="text-xs text-gray-500">
              Cost Heads + Meal Costs
            </div>
          </div>
          <div className="p-3 bg-white border rounded">
            <div className="text-sm text-gray-600">Total Bazar Collected</div>
            <div className="text-xl font-bold text-green-700">
              {bazarColumnTotal().toFixed(2)} Tk
            </div>
            <div className="text-xs text-gray-500">
              Total amount users paid for bazar
            </div>
          </div>
          <div className="p-3 bg-white border rounded">
            <div className="text-sm text-gray-600">Net Balance</div>
            <div className={`text-xl font-bold ${grandTotal() >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
              {grandTotal().toFixed(2)} Tk
            </div>
            <div className="text-xs text-gray-500">
              Positive = Need to collect | Negative = Need to refund
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}