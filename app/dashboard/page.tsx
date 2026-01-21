"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      router.push("/login");
      return;
    }

    axios
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: { action: "getUserList", token },
      })
      .then((res) => setUsers(res.data))
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch users.");
      });
  }, [router]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">User List</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border px-4 py-2">ID</th>
            <th className="border px-4 py-2">Name</th>
            <th className="border px-4 py-2">Email</th>
            <th className="border px-4 py-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => (
            <tr key={idx}>
              <td className="border px-4 py-2">{u.id}</td>
              <td className="border px-4 py-2">{u.name}</td>
              <td className="border px-4 py-2">{u.email}</td>
              <td className="border px-4 py-2">{u.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
