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

    // Only redirect if token is missing
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
        console.log('dsjdhajs khdsaj hdasjk hadjsk hdaskj', res);
        
        // Expected success
        if (Array.isArray(res.data)) {
          setCostHeads(res.data);
        }
        // GAS returned error
        else if (res.data?.error) {
          setError(res.data.error);
        }
        // Unknown response
        else {
          setError("Unexpected server response.");
        }
      })
      .catch((err) => {
        // Network / Axios / CORS error
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error || err.message);
        } else {
          setError("Something went wrong while fetching cost heads.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-600">Loading cost heads...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-50">
        Cost Heads
      </h1>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded border border-red-400 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && costHeads.length === 0 && (
        <p className="text-gray-600">No cost heads found.</p>
      )}

      {/* Table */}
      {costHeads.length > 0 && (
        <table className="min-w-full border border-gray-300 dark:border-gray-600 dark:text-gray-50">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="border px-4 py-2">ID</th>
              <th className="border px-4 py-2">Name</th>
              <th className="border px-4 py-2">Amount</th>
              <th className="border px-4 py-2">Type</th>
              <th className="border px-4 py-2">Created At</th>
              <th className="border px-4 py-2">Updated At</th>
            </tr>
          </thead>

          <tbody>
            {costHeads.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <td className="border px-4 py-2">{c.id}</td>
                <td className="border px-4 py-2">{c.name}</td>
                <td className="border px-4 py-2">{c.amount}</td>
                <td className="border px-4 py-2">{c.type}</td>
                <td className="border px-4 py-2">
                  {new Date(c.createdAt).toLocaleString()}
                </td>
                <td className="border px-4 py-2">
                  {new Date(c.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
