"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface User {
  id: string;
  name: string;
  email: string;
  type: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) return; // DashboardLayout already redirects

    axios
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
      .catch(() => setError("Failed to fetch users."));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-50">
        Users
      </h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table className="min-w-full border border-gray-300 dark:border-gray-600 dark:text-gray-50">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="border px-4 py-2">ID</th>
              <th className="border px-4 py-2">Name</th>
              <th className="border px-4 py-2">Email</th>
              <th className="border px-4 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <td className="border px-4 py-2">{u.id}</td>
                <td className="border px-4 py-2">{u.name}</td>
                <td className="border px-4 py-2">{u.email}</td>
                <td className="border px-4 py-2">{u.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
