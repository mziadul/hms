"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface CostHead {
  id: string;
  name: string;
  amount: number;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export default function CostHeadsPage() {
  const [costHeads, setCostHeads] = useState<CostHead[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("userToken");

    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    axios
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: {
          action: "getCostHeads",
          token,
        },
      })
      .then((res) => {
        // নতুন রেসপন্স ফরম্যাট অনুযায়ী চেক
        const data = res.data;

        // যদি রেসপন্স অবজেক্ট হয় এবং তার ভেতর costHeads অ্যারে থাকে
        if (data && Array.isArray(data.costHeads)) {
          setCostHeads(data.costHeads);
        } 
        // যদি সরাসরি অ্যারে আসে (পুরানো ফরম্যাট ব্যাকআপ হিসেবে)
        else if (Array.isArray(data)) {
          setCostHeads(data);
        }
        // GAS রিটার্ন করা এরর চেক
        else if (data?.error) {
          setError(data.error);
        }
        else {
          setError("Unexpected server response format.");
        }
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error || err.message);
        } else {
          setError("Something went wrong while fetching cost heads.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-600 p-6">Loading cost heads...</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-50">
        Cost Heads List
      </h1>

      {error && (
        <div className="mb-4 rounded border border-red-400 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {!error && costHeads.length === 0 && (
        <p className="text-gray-600">No cost heads found.</p>
      )}

      {costHeads.length > 0 && (
        <div className="overflow-x-auto border rounded-lg shadow">
          <table className="min-w-full border border-gray-300 dark:border-gray-600 dark:text-gray-50 text-sm">
            <thead className="bg-gray-200 dark:bg-gray-700">
              <tr>
                <th className="border px-4 py-2">ID</th>
                <th className="border px-4 py-2 text-left">Name</th>
                <th className="border px-4 py-2">Amount</th>
                <th className="border px-4 py-2">Type</th>
                <th className="border px-4 py-2">Created At</th>
                <th className="border px-4 py-2">Updated At</th>
              </tr>
            </thead>

            <tbody>
              {costHeads.map((c) => (
                <tr key={c.id} className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <td className="border px-4 py-2 text-center">{c.id}</td>
                  <td className="border px-4 py-2 font-medium">{c.name}</td>
                  <td className="border px-4 py-2 text-right">{c.amount.toLocaleString()}</td>
                  <td className="border px-4 py-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${c.type === 'Prepaid' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="border px-4 py-2 text-gray-500">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="border px-4 py-2 text-gray-500">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}