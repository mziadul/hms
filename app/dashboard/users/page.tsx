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
    if (confirm("Are you sure you want to remove this member?")) {
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
      alert("✅ Directory updated successfully!");
    } catch (err) {
      alert("❌ Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return <Spinner isLoading={true} message="Verifying access..." />;
  }

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Spinner isLoading={loading} message="Processing..." />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight border-l-4 border-teal-500 pl-3">
            Member Directory
          </h1>
          <p className="text-xs opacity-60 mt-1">
            Manage system users, credentials and access roles
          </p>
        </div>

        {/* BUTTON GROUP WITH STANDARD COLORS */}
        <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-inner w-full md:w-auto">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full md:w-auto px-6 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold text-xs uppercase rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 hover:border-teal-500 transition-all"
            >
              Edit Directory
            </button>
          ) : (
            <>
              <button
                onClick={addNewRow}
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-1"
              >
                <span>+</span> Add New
              </button>
              <button
                onClick={handleSave}
                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white font-black uppercase text-[10px] rounded-lg shadow-md hover:bg-blue-700 transition-all"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setUsers(JSON.parse(JSON.stringify(originalUsers)));
                }}
                className="flex-1 md:flex-none px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold uppercase text-[10px] rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase tracking-widest font-black opacity-70">
                <th className="p-5 w-16 text-center">Action</th>
                <th className="p-5">Ref ID</th>
                <th className="p-5">Full Name</th>
                <th className="p-5">Email Address</th>
                <th className="p-5">Password</th>
                <th className="p-5">Status / Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map((u, idx) => {
                const isChanged =
                  isEditing &&
                  u.id &&
                  JSON.stringify(u) !==
                    JSON.stringify(originalUsers.find((o) => o.id === u.id));
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group ${
                      isChanged ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
                    }`}
                  >
                    <td className="p-5 text-center">
                      {isEditing ? (
                        <button
                          onClick={() => removeRow(idx)}
                          className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                          title="Remove Member"
                        >
                          ✕
                        </button>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-700">
                          —
                        </span>
                      )}
                    </td>
                    <td className="p-5 font-mono text-[10px] font-bold text-gray-400">
                      {u.id || (
                        <span className="text-emerald-500 italic">NEW</span>
                      )}
                    </td>
                    <td className="p-5">
                      {isEditing ? (
                        <input
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold transition-all"
                          value={u.name}
                          onChange={(e) =>
                            handleInputChange(idx, "name", e.target.value)
                          }
                        />
                      ) : (
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {u.name}
                        </span>
                      )}
                    </td>
                    <td className="p-5">
                      {isEditing ? (
                        <input
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                          value={u.email}
                          onChange={(e) =>
                            handleInputChange(idx, "email", e.target.value)
                          }
                        />
                      ) : (
                        <span className="text-gray-600 dark:text-gray-400">
                          {u.email}
                        </span>
                      )}
                    </td>
                    <td className="p-5">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                          value={u.password || ""}
                          placeholder="••••••"
                          onChange={(e) =>
                            handleInputChange(idx, "password", e.target.value)
                          }
                        />
                      ) : (
                        <span className="text-gray-300 italic tracking-widest text-xs">
                          ••••••••
                        </span>
                      )}
                    </td>
                    <td className="p-5">
                      {isEditing ? (
                        <select
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold transition-all"
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
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${
                            u.type === "admin"
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                          }`}
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
    </div>
  );
}
