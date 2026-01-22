"use client";

import { useState } from "react";
import axios from "axios";

export default function AddCostHeadPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    type: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.name.trim() || !formData.type.trim()) {
      setError("Both name and type are required.");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        process.env.NEXT_PUBLIC_GAS_URL!,
        null,
        {
          params: {
            action: "addCostHead", // ✅ REQUIRED by GAS
            name: formData.name,
            type: formData.type,
          },
        }
      );

      if (response.data?.success) {
        setSuccess(response.data.message || "Cost head added successfully.");
        setFormData({ name: "", type: "" });
      } else {
        setError(response.data?.error || "Something went wrong.");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to connect to API."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        Add Cost Head
      </h1>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-700 border border-green-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Cost Head Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. Travel Expense"
            required
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Cost Head Type *
          </label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value })
            }
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="">Select type</option>
            <option value="Prepaid">Prepaid</option>
            <option value="Postpaid">Postpaid</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => setFormData({ name: "", type: "" })}
            className="px-4 py-2 border rounded"
          >
            Clear
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Saving..." : "Add Cost Head"}
          </button>
        </div>
      </form>
    </div>
  );
}
