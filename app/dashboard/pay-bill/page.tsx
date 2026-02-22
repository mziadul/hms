"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import api from "@/utils/api";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";

export default function PaymentManagement() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [bills, setBills] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [token, setToken] = useState<string | null>(null);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>(
    {},
  );

  const monthList = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      name: new Intl.DateTimeFormat("en-US", { month: "long" }).format(
        new Date(2024, i),
      ),
    }));
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("userToken");
    if (!storedToken) {
      router.push("/login");
      return;
    }
    setToken(storedToken);
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const targetMonthName = monthList[selectedMonth - 1].name;
      const [archiveRes, usersRes] = await Promise.all([
        api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
          params: {
            action: "getMonthlyArchive",
            token,
            year: selectedYear,
            month: targetMonthName,
          },
        }),
        api.get(process.env.NEXT_PUBLIC_GAS_URL!, {
          params: { action: "getUsers", token },
        }),
      ]);
      setBills(Array.isArray(archiveRes.data) ? archiveRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedYear, selectedMonth, monthList]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

  const submitPayment = async (bill: any, amount: number) => {
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");

    const userId = String(bill["User ID"]);
    const userName = users.find((u) => String(u.id) === userId)?.name || "User";
    if (!confirm(`Confirm ${amount} Tk for ${userName}?`)) return;

    setProcessing(true);
    try {
      const res = await api.post(
        `${process.env.NEXT_PUBLIC_GAS_URL}?action=updatePayment&token=${token}`,
        JSON.stringify({
          userId: userId,
          year: bill.Year,
          month: bill.Month,
          amount: amount,
        }),
        { headers: { "Content-Type": "text/plain" } },
      );

      if (res.data.success) {
        alert("✅ Payment Updated & Email Sent!");
        setPaymentInputs((prev) => ({ ...prev, [userId]: "" }));
        fetchData();
      } else {
        alert("❌ Error: " + res.data.error);
      }
    } catch (err) {
      alert("Something went wrong. Check internet or GAS deployment.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Spinner
        isLoading={loading || processing}
        message="Processing Payment..."
      />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight border-l-4 border-teal-500 pl-3">
            Payment Manager
          </h1>
          <p className="text-xs opacity-60 mt-1">
            Review and update member dues
          </p>
        </div>

        {/* DROPDOWN PILL CONTAINER */}
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-inner w-full md:w-auto">
          <select
            className="flex-1 md:flex-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2 px-4 rounded-lg outline-none font-bold text-sm shadow-sm border border-transparent focus:border-teal-500 transition-all"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            className="flex-1 md:flex-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2 px-4 rounded-lg outline-none font-bold text-sm shadow-sm border border-transparent focus:border-teal-500 transition-all"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {monthList.map((m) => (
              <option key={m.value} value={m.value}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase tracking-widest font-black opacity-70">
                <th className="p-5">Member Name</th>
                <th className="p-5 text-center">Net Bill</th>
                <th className="p-5 text-center">Paid Amount</th>
                <th className="p-5 text-center">Due Balance</th>
                <th className="p-5 text-right">Payment Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {bills.map((bill, idx) => {
                const uId = String(bill["User ID"]);
                const netPayable = Number(bill["Net Payable"] || 0);
                const paidAmount = Number(bill["Paid Amount"] || 0);
                const due = Math.round(netPayable - paidAmount);
                const userName =
                  users.find((u) => String(u.id) === uId)?.name || "Unknown";

                return (
                  <tr
                    key={`${uId}-${idx}`}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group"
                  >
                    <td className="p-5">
                      <div className="font-bold text-gray-800 dark:text-gray-100">
                        {userName}
                      </div>
                    </td>
                    <td className="p-5 text-center font-bold text-gray-900 dark:text-gray-100">
                      {netPayable.toLocaleString()}{" "}
                      <span className="text-[10px] opacity-50">TK</span>
                    </td>
                    <td className="p-5 text-center font-bold text-teal-600 dark:text-teal-400">
                      {paidAmount.toLocaleString()}{" "}
                      <span className="text-[10px] opacity-50">TK</span>
                    </td>
                    <td className="p-5 text-center">
                      <span
                        className={`font-black text-sm px-2 py-1 rounded-lg ${due > 0 ? "text-rose-600 bg-rose-50 dark:bg-rose-900/20" : "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"}`}
                      >
                        {due > 0 ? `${due.toLocaleString()} TK` : "CLEARED"}
                      </span>
                    </td>
                    <td className="p-5">
                      {due > 0 ? (
                        <div className="flex gap-2 justify-end items-center">
                          <input
                            className="w-24 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold"
                            type="number"
                            placeholder="Amt"
                            value={paymentInputs[uId] || ""}
                            onChange={(e) =>
                              setPaymentInputs({
                                ...paymentInputs,
                                [uId]: e.target.value,
                              })
                            }
                          />
                          <button
                            onClick={() =>
                              submitPayment(
                                bill,
                                parseFloat(paymentInputs[uId]),
                              )
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] uppercase font-black shadow-md transition-all active:scale-95"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => submitPayment(bill, due)}
                            className="bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black shadow-md transition-all active:scale-95"
                          >
                            Full Payment
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <span className="text-emerald-600 text-sm">✓</span>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {bills.length === 0 && !loading && (
        <div className="text-center py-24 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 mt-6">
          <p className="text-lg font-bold opacity-30 uppercase tracking-widest">
            No payment records found
          </p>
        </div>
      )}
    </div>
  );
}
