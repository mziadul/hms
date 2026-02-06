"use client";

import { useEffect, useState } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";

interface User {
  id?: string;
  name: string;
  email: string;
  password?: string;
  type: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [originalUsers, setOriginalUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const info = localStorage.getItem("userInfo");
    const token = localStorage.getItem("userToken");

    if (!token || !info) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(info);

    if (userData.type !== "admin") {
      router.replace("/dashboard");
      return;
    }

    setIsAuthorized(true);
    fetchUsers();
  }, [router]);

  const fetchUsers = () => {
    const token = localStorage.getItem("userToken");
    setLoading(true);
    api
      .get(process.env.NEXT_PUBLIC_GAS_URL!, {
        params: { action: "getUsers", token },
      })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setUsers(res.data);
          setOriginalUsers(JSON.parse(JSON.stringify(res.data)));
        } else {
          setError(res.data.error || "Error fetching users");
        }
      })
      .catch(() => setError("Failed to fetch users."))
      .finally(() => setLoading(false));
  };

  const handleInputChange = (
    index: number,
    field: keyof User,
    value: string,
  ) => {
    const updated = [...users];
    updated[index] = { ...updated[index], [field]: value };
    setUsers(updated);
  };

  const addNewRow = () => {
    setUsers([...users, { name: "", email: "", password: "", type: "user" }]);
  };

  const removeRow = (index: number) => {
    if (
      confirm("Remove this user from the list? (Changes applied after saving)")
    ) {
      const updated = users.filter((_, i) => i !== index);
      setUsers(updated);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("userToken");
    const missingPassword = users.some(
      (u) => !u.id && (!u.password || u.password.trim() === ""),
    );
    if (missingPassword) {
      alert("Password is mandatory for new users!");
      return;
    }

    const changedUsers = users.filter((user) => {
      if (!user.id) return true;
      const original = originalUsers.find((o) => o.id === user.id);
      return (
        !original ||
        user.name !== original.name ||
        user.email !== original.email ||
        user.type !== original.type ||
        (user.password && user.password.trim() !== "")
      );
    });

    const activeIds = users.filter((u) => u.id).map((u) => u.id);

    setLoading(true);
    try {
      const payload = { users: changedUsers, activeIds: activeIds };
      const formData = new FormData();
      formData.append("users", JSON.stringify(payload));
      await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=upsertUsers&token=${token}`,
        formData,
      );
      setIsEditing(false);
      fetchUsers();
      alert("Sync complete!");
    } catch (err) {
      alert("Save failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return <Spinner isLoading={true} message="Verifying access..." />;
  }

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      <Spinner isLoading={loading} message="Processing..." />

      {/* Updated header container: flex-col for mobile, flex-row for desktop */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wider">
          Member Directory
        </h1>

        {/* Updated button group: flex-wrap to prevent screen overflow */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full sm:w-auto px-4 py-2 border-2 border-gray-800 dark:border-gray-400 font-black hover:bg-gray-800 hover:text-white dark:hover:bg-gray-400 dark:hover:text-gray-900 uppercase text-xs transition-colors"
            >
              Enter Edit Mode
            </button>
          ) : (
            <>
              <button
                onClick={addNewRow}
                className="flex-1 sm:flex-none px-4 py-2 bg-green-100 dark:bg-green-900/30 border-2 border-green-600 text-green-700 dark:text-green-400 font-black uppercase text-xs whitespace-nowrap"
              >
                + Add Member
              </button>
              <button
                onClick={handleSave}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 border-2 border-blue-700 text-white font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap"
              >
                Save All Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setUsers(JSON.parse(JSON.stringify(originalUsers)));
                }}
                className="w-full sm:w-auto px-4 py-2 border-2 border-gray-300 dark:border-gray-600 font-black uppercase text-xs whitespace-nowrap"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-xl shadow-md">
        <table className="min-w-full text-sm text-left border-separate border-spacing-0">
          <thead className="bg-gray-200 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase text-gray-700 dark:text-gray-300 w-16 text-center">
                Action
              </th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase text-gray-700 dark:text-gray-300">
                ID
              </th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase text-gray-700 dark:text-gray-300">
                Name
              </th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase text-gray-700 dark:text-gray-300">
                Email
              </th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase text-gray-700 dark:text-gray-300">
                Password
              </th>
              <th className="px-6 py-4 border-b border-gray-300 dark:border-gray-700 font-black uppercase text-gray-700 dark:text-gray-300">
                Role
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 dark:divide-gray-700">
            {users.map((u, idx) => {
              const isChanged =
                isEditing &&
                u.id &&
                JSON.stringify(u) !==
                  JSON.stringify(originalUsers.find((o) => o.id === u.id));
              return (
                <tr
                  key={idx}
                  className={`${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-100 dark:bg-gray-800/40"} ${isChanged ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}`}
                >
                  <td className="px-6 py-4 border-r border-gray-200 dark:border-gray-800 text-center">
                    {isEditing ? (
                      <button
                        onClick={() => removeRow(idx)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 font-black text-lg"
                        title="Delete Row"
                      >
                        ✕
                      </button>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-700">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs font-bold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800">
                    {u.id || "NEW"}
                  </td>
                  <td className="px-6 py-4 min-w-[200px] border-r border-gray-200 dark:border-gray-800">
                    {isEditing ? (
                      <input
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded outline-none text-gray-900 dark:text-white"
                        value={u.name}
                        onChange={(e) =>
                          handleInputChange(idx, "name", e.target.value)
                        }
                      />
                    ) : (
                      <span className="font-bold">{u.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 min-w-[300px] border-r border-gray-200 dark:border-gray-800">
                    {isEditing ? (
                      <input
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded outline-none text-gray-900 dark:text-white"
                        value={u.email}
                        onChange={(e) =>
                          handleInputChange(idx, "email", e.target.value)
                        }
                      />
                    ) : (
                      <span>{u.email}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 min-w-[200px] border-r border-gray-200 dark:border-gray-800">
                    {isEditing ? (
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded outline-none text-gray-900 dark:text-white"
                        value={u.password || ""}
                        placeholder="New password"
                        onChange={(e) =>
                          handleInputChange(idx, "password", e.target.value)
                        }
                      />
                    ) : (
                      <span className="text-gray-400 italic">********</span>
                    )}
                  </td>
                  <td className="px-6 py-4 min-w-[200px]">
                    {isEditing ? (
                      <select
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-1 py-1 rounded outline-none text-gray-900 dark:text-white"
                        value={u.type}
                        onChange={(e) =>
                          handleInputChange(idx, "type", e.target.value)
                        }
                      >
                        <option value="user">USER</option>
                        <option value="admin">ADMIN</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-black uppercase border ${u.type === "admin" ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700" : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700"}`}
                      >
                        {u.type}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
