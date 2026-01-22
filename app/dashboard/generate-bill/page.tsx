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

export default function MonthlyBillForm() {
  const [users, setUsers] = useState<User[]>([]);
  const [costHeads, setCostHeads] = useState<CostHead[]>([]);
  const [amounts, setAmounts] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  // Get token on client only
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userToken = localStorage.getItem("userToken");
      setToken(userToken);
    }
  }, []);

  // Fetch users and cost heads when token is available
  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    const fetchData = async () => {
      try {
        const [usersRes, costHeadsRes] = await Promise.all([
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { params: { action: "getUserList", token } }),
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { params: { action: "getCostHeads", token } }),
        ]);

        if (usersRes.data?.error) {
          setError(usersRes.data.error);
          setLoading(false);
          return;
        }

        if (costHeadsRes.data?.error) {
          setError(costHeadsRes.data.error);
          setLoading(false);
          return;
        }

        const usersData: User[] = Array.isArray(usersRes.data) ? usersRes.data : [];
        const costHeadsData: CostHead[] = Array.isArray(costHeadsRes.data) ? costHeadsRes.data : [];

        setUsers(usersData);
        setCostHeads(costHeadsData);

        // Initialize amounts map
        const initialAmounts: Record<string, Record<number, number>> = {};
        usersData.forEach((u) => {
          initialAmounts[u.id] = {};
          costHeadsData.forEach((c) => {
            initialAmounts[u.id][c.id] = 0; // start with 0
          });
        });
        setAmounts(initialAmounts);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch data from API.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) return <p className="text-gray-600">Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  // Handle input change
  const handleChange = (userId: string, headId: number, value: string) => {
    const num = parseFloat(value) || 0;
    setAmounts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [headId]: num },
    }));
  };

  // Distribute a cost head equally among users based on costHeads amount
  const distributeEqually = (headId: number) => {
    const costHead = costHeads.find((c) => c.id === headId);
    if (!costHead) return;

    const total = costHead.amount;
    if (total === 0) return alert("Total amount for this cost head is 0");

    const perUser = parseFloat((total / users.length).toFixed(2));

    setAmounts((prev) => {
      const newAmounts = { ...prev };
      users.forEach((u) => (newAmounts[u.id][headId] = perUser));
      return newAmounts;
    });
  };

  // Calculate totals
  const userTotal = (userId: string) =>
    costHeads.reduce((sum, c) => sum + amounts[userId][c.id], 0);

  const headTotal = (headId: number) =>
    users.reduce((sum, u) => sum + amounts[u.id][headId], 0);

  const grandTotal = () =>
    users.reduce((sum, u) => sum + userTotal(u.id), 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-50">
        Monthly Cost Sheet
      </h1>

      <div className="overflow-auto border rounded-lg shadow">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="bg-purple-700 text-white">
              <th className="px-4 py-2">Name</th>
              {costHeads.map((head) => (
                <th key={head.id} className="px-4 py-2">
                  <div className="flex flex-col items-center">
                    <span>{head.name}</span>
                    <button
                      className="mt-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                      onClick={() => distributeEqually(head.id)}
                    >
                      Distribute
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-4 py-2 bg-purple-800">Total</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="even:bg-gray-100 dark:even:bg-gray-800">
                <td className="border px-2 py-1 font-medium">{u.name}</td>
                {costHeads.map((c) => (
                  <td key={c.id} className="border px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-2 py-1 border rounded text-right"
                      value={amounts[u.id][c.id]}
                      onChange={(e) => handleChange(u.id, c.id, e.target.value)}
                    />
                  </td>
                ))}
                <td className="border px-2 py-1 font-bold text-right">
                  {userTotal(u.id).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="bg-green-600 text-white font-bold">
              <td className="px-2 py-1">Total</td>
              {costHeads.map((c) => (
                <td key={c.id} className="px-2 py-1 text-right">
                  {headTotal(c.id).toFixed(2)}
                </td>
              ))}
              <td className="px-2 py-1 text-right">{grandTotal().toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
