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
  // কাস্টম ভ্যালু স্টোর করার স্টেট
  const [customValues, setCustomValues] = useState<Record<string, Record<string, number>>>({});
  // ইউজারের ইনপুট করা অ্যামাউন্ট স্টোর করার স্টেট
  const [amounts, setAmounts] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userToken = localStorage.getItem("userToken");
      setToken(userToken);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [usersRes, headsRes] = await Promise.all([
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { params: { action: "getUserList", token } }),
          axios.get(process.env.NEXT_PUBLIC_GAS_URL!, { params: { action: "getCostHeads", token } }),
        ]);

        // ইউজার লিস্ট সেট করা
        const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
        setUsers(usersData);

        // আপনার দেওয়া নতুন ফরম্যাট অনুযায়ী ডাটা ডিকনস্ট্রাক্ট করা
        const headsData = headsRes.data?.costHeads || [];
        const customs = headsRes.data?.customValues || {};

        setCostHeads(headsData);
        setCustomValues(customs);

        // ইনপুট গ্রিড ইনিশিয়ালাইজ করা (ডিফল্ট ০)
        const initialAmounts: Record<string, Record<number, number>> = {};
        usersData.forEach((u) => {
          initialAmounts[u.id] = {};
          headsData.forEach((c: CostHead) => {
            initialAmounts[u.id][c.id] = 0;
          });
        });
        setAmounts(initialAmounts);
      } catch (err: any) {
        setError("ডেটা লোড করতে ব্যর্থ হয়েছে। দয়া করে API সংযোগ চেক করুন।");
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // ম্যানুয়াল ইনপুট হ্যান্ডলার
  const handleChange = (userId: string, headId: number, value: string) => {
    const num = parseFloat(value) || 0;
    setAmounts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [headId]: num },
    }));
  };

  // স্মার্ট ডিস্ট্রিবিউশন লজিক: কাস্টম ভ্যালু থাকলে আগে সেট হবে, বাকিটা অন্যদের মধ্যে ভাগ হবে
  const distributeSmartly = (headId: number) => {
    const costHead = costHeads.find((c) => c.id === headId);
    if (!costHead || costHead.amount === 0) return alert("এই খাতের মোট অ্যামাউন্ট ০");

    let totalAmountToSplit = costHead.amount;
    let usersWithoutCustom: User[] = [];
    const newHeadAmounts: Record<string, number> = {};

    // ১. কাস্টম/ফিক্সড ভ্যালুগুলো আগে ডিডাকশন করা
    users.forEach((u) => {
      const customVal = customValues[u.id]?.[String(headId)];
      if (customVal !== undefined) {
        newHeadAmounts[u.id] = customVal;
        totalAmountToSplit -= customVal;
      } else {
        usersWithoutCustom.push(u);
      }
    });

    // ২. অবশিষ্ট টাকা বাকিদের মধ্যে সমানভাবে ভাগ করা
    if (usersWithoutCustom.length > 0) {
      const perUser = parseFloat((totalAmountToSplit / usersWithoutCustom.length).toFixed(2));
      usersWithoutCustom.forEach((u) => {
        newHeadAmounts[u.id] = perUser;
      });
    }

    // ৩. স্টেট আপডেট করা
    setAmounts((prev) => {
      const updated = { ...prev };
      users.forEach((u) => {
        if (!updated[u.id]) updated[u.id] = {};
        updated[u.id][headId] = newHeadAmounts[u.id] || 0;
      });
      return updated;
    });
  };

  // ক্যালকুলেশন ফাংশনসমূহ
  const userTotal = (userId: string) => 
    costHeads.reduce((sum, c) => sum + (amounts[userId]?.[c.id] || 0), 0);

  const headTotal = (headId: number) => 
    users.reduce((sum, u) => sum + (amounts[u.id]?.[headId] || 0), 0);

  const grandTotal = () => 
    users.reduce((sum, u) => sum + userTotal(u.id), 0);

  if (loading) return <p className="p-6 text-blue-600 font-bold">লোড হচ্ছে...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">মাসিক খরচ বিবরণী (Smart Distribute)</h1>

      <div className="overflow-x-auto border rounded-xl shadow-lg">
        <table className="min-w-full border-collapse bg-white text-sm">
          <thead>
            <tr className="bg-purple-700 text-white">
              <th className="px-4 py-3 border border-purple-600 text-left">ইউজারের নাম</th>
              {costHeads.map((head) => (
                <th key={head.id} className="px-4 py-3 border border-purple-600">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">{head.name}</span>
                    <button
                      className="mt-2 text-[10px] bg-yellow-400 hover:bg-yellow-500 text-black px-2 py-1 rounded font-bold uppercase tracking-tighter transition-colors"
                      onClick={() => distributeSmartly(head.id)}
                    >
                      Generate
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 border border-purple-600 bg-purple-800 text-base">ব্যক্তিগত মোট</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-purple-50 transition-colors border-b">
                <td className="px-4 py-2 font-medium text-gray-700 bg-gray-50 border">{u.name}</td>
                {costHeads.map((c) => (
                  <td key={c.id} className="px-2 py-1 border">
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-right 
                                focus:outline-none focus:ring-2 focus:ring-purple-400 
                                /* নিচের ক্লাসগুলো যোগ করুন */
                                text-gray-900 dark:text-gray-100 
                                bg-white dark:bg-gray-800"
                      value={amounts[u.id]?.[c.id] ?? 0}
                      onChange={(e) => handleChange(u.id, c.id, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-4 py-2 font-bold text-right text-purple-700 bg-gray-50 border">
                  {userTotal(u.id).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="bg-green-600 text-white font-bold">
            <tr>
              <td className="px-4 py-3 border border-green-500">খাত ভিত্তিক মোট</td>
              {costHeads.map((c) => (
                <td key={c.id} className="px-4 py-3 border border-green-500 text-right">
                  {headTotal(c.id).toFixed(2)}
                </td>
              ))}
              <td className="px-4 py-3 border border-green-500 text-right text-yellow-200 text-lg">
                {grandTotal().toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}