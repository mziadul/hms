"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    id: "",
    name: "",
    email: "",
    password: "",
    type: "",
    updatedBy: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const token = localStorage.getItem("userToken");
    if (!token) {
      setError("You are not logged in.");
      router.push("/login");
      return;
    }

    try {
      const res = await axios.post(process.env.NEXT_PUBLIC_GAS_URL!, null, {
        params: {
          action: "addUsers",
          token,
          ...form,
        },
      });

      if (res.data?.success) {
        setSuccess(res.data.success);
        setForm({ id: "", name: "", email: "", password: "", type: "", updatedBy: "" });
      } else {
        setError(res.data?.error || "Failed to add user.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to add user.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Admin Menu */}
      <nav className="flex gap-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded shadow">
        <Link
          href="/dashboard"
          className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Dashboard
        </Link>
        <Link
          href="/dashboard/users"
          className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Users
        </Link>
        <Link
          href="/dashboard/users/add"
          className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Add User
        </Link>
      </nav>

      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Add New User
      </h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}
      {success && <p className="text-green-500 mb-4">{success}</p>}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 p-6 rounded shadow max-w-lg space-y-4"
      >
        <input
          type="text"
          name="id"
          placeholder="ID"
          value={form.id}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select Type</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <input
          type="text"
          name="updatedBy"
          placeholder="Updated By"
          value={form.updatedBy}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Add User
        </button>
      </form>
    </div>
  );
}
