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

interface BazarCost {
  id: number;
  userId: number;
  year: number;
  month: number;
  amount: number;
  status: string;
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
  
  // Bazar cost related states
  const [bazarCosts, setBazarCosts] = useState<BazarCost[]>([]);
  const [bazarTotal, setBazarTotal] = useState<number>(0);
  const [bazarLoading, setBazarLoading] = useState(false);
  
  // User-wise bazar amounts
  const [userBazarAmounts, setUserBazarAmounts] = useState<Record<string, number>>({});

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

  // Fetch bazar costs when year/month changes
  useEffect(() => {
    if (!token || !selectedYear || !selectedMonth) return;
    fetchBazarCosts();
  }, [token, selectedYear, selectedMonth]);

  const fetchBazarCosts = async () => {
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
      
      console.log("BazarCost response:", response.data);
      
      // Check if response contains error
      if (response.data && response.data.error) {
        console.error("Error from GAS:", response.data.error);
        setBazarTotal(0);
        setBazarCosts([]);
        setUserBazarAmounts({});
        return;
      }
      
      const bazarData = Array.isArray(response.data) ? response.data : [];
      setBazarCosts(bazarData);
      
      // Calculate total amount
      const total = bazarData.reduce((sum: number, item: BazarCost) => {
        return sum + (item.amount || 0);
      }, 0);
      
      setBazarTotal(total);
      
      // Calculate user-wise bazar amounts
      const userAmounts: Record<string, number> = {};
      bazarData.forEach((item: BazarCost) => {
        const userId = String(item.userId);
        userAmounts[userId] = (userAmounts[userId] || 0) + item.amount;
      });
      
      setUserBazarAmounts(userAmounts);
      console.log("User bazar amounts:", userAmounts);
      console.log("Total bazar amount calculated:", total);
      
    } catch (err: any) {
      console.error("Error fetching bazar costs:", err.response?.data || err.message);
      
      // Check if error is due to invalid action
      if (err.response?.data?.error === "Invalid action") {
        setError("getBazarCosts action not found in GAS script. Please add the function to your GAS script.");
      } else {
        setError("Failed to load bazar costs. Please check if BazarCost sheet exists.");
      }
      
      setBazarTotal(0);
      setBazarCosts([]);
      setUserBazarAmounts({});
    } finally {
      setBazarLoading(false);
    }
  };

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
          // Bazar amount initial value - 'bazar' is a string key
          initialAmounts[u.id]['bazar'] = 0;
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

  // Update amounts when userBazarAmounts changes
  useEffect(() => {
    if (Object.keys(userBazarAmounts).length > 0) {
      setAmounts(prev => {
        const updated = { ...prev };
        Object.keys(userBazarAmounts).forEach(userId => {
          if (updated[userId]) {
            updated[userId]['bazar'] = userBazarAmounts[userId];
          }
        });
        return updated;
      });
    }
  }, [userBazarAmounts]);

  // Fetch meals data
  const fetchMeals = async () => {
    if (!token) return;
    if (!selectedYear || !selectedMonth) {
      alert("Please select year and month first");
      return;
    }
    
    // First refresh bazar total
    await fetchBazarCosts();
    
    if (bazarTotal <= 0) {
      alert("No bazar costs found for selected month or total amount is zero!");
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
      alert("Bazar total is zero! Please add bazar costs first.");
      return;
    }
    
    // 1. Calculate total meals
    const totalMeals = mealsData.reduce((sum, meal) => sum + meal.amount, 0);
    console.log("Total meals:", totalMeals);
    
    if (totalMeals === 0) {
      alert("Total meals count is zero!");
      return;
    }
    
    // 2. Calculate meal rate
    const mealRate = bazarTotal / totalMeals;
    console.log("Meal rate:", mealRate.toFixed(2), "Bazar total:", bazarTotal);
    
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
    alert(`Meal cost calculation completed!\n\n` +
          `Total meals: ${totalMeals}\n` +
          `Bazar total: ${bazarTotal.toFixed(2)} Tk\n` +
          `Meal rate: ${mealRate.toFixed(2)} Tk\n` +
          `Number of bazar records: ${bazarCosts.length}`);
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

  // Calculation functions - UPDATED WITH BAZAR DEDUCTION
  const userTotal = (userId: string) => {
    let total = 0;
    
    // Add cost heads
    costHeads.forEach(c => {
      total += amounts[userId]?.[c.id] || 0;
    });
    
    // Add meal cost
    total += amounts[userId]?.['meal'] || 0;
    
    // SUBTRACT bazar amount (this is money the user has already paid)
    total -= amounts[userId]?.['bazar'] || 0;
    
    return total;
  };

  const headTotal = (headId: number) => 
    users.reduce((sum, u) => sum + (amounts[u.id]?.[headId] || 0), 0);

  const mealColumnTotal = () => 
    users.reduce((sum, u) => sum + (amounts[u.id]?.['meal'] || 0), 0);

  const bazarColumnTotal = () => 
    users.reduce((sum, u) => sum + (amounts[u.id]?.['bazar'] || 0), 0);

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

  // Refresh bazar costs button
  const handleRefreshBazar = () => {
    fetchBazarCosts();
  };

  if (loading) return <p className="p-6 text-blue-600 font-bold">Loading...</p>;
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
