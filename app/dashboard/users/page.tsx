"use client";

import { useEffect, useState } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";

interface User {
  id: string;
  name: string;
  email: string;
  type: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    api
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: { action: "getUsers", token },
      })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setUsers(res.data);
        } else if (res.data.error) {
          setError(res.data.error);
        } else {
          setError("Unexpected server response.");
        }
      })
      .catch(() => setError("Failed to fetch users."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <Spinner isLoading={loading} message="Fetching users..." />

      <h1 className="text-2xl font-bold mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
        Member Directory
      </h1>

      {error ? (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
        </div>
      ) : users.length === 0 && !loading ? (
        <div className="text-center py-20 opacity-60">
          <p className="text-lg italic">No members found in the system.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-xl shadow-md">
          <table className="min-w-full text-sm text-left border-separate border-spacing-0">
            <thead className="bg-gray-200 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  ID
                </th>
                <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Member Name
                </th>
                <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Email Address
                </th>
                <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Role
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 dark:divide-gray-700">
              {users.map((u, idx) => (
                <tr
                  key={u.id}
                  className={`${
                    idx % 2 === 0 
                      ? "bg-white dark:bg-gray-900" 
                      : "bg-gray-100 dark:bg-gray-800/40" // Deepened the light mode color here
                  } hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group`}
                >
                  <td className="px-6 py-4 font-mono text-xs font-bold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800">
                    {u.id}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-100">
                    {u.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    {u.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-black uppercase border ${
                      u.type === 'admin' 
                        ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700' 
                        : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                    }`}>
                      {u.type}
                    </span>
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