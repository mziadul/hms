"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-100 dark:bg-gray-900 p-6 flex flex-col">
        <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-50">
          Admin Panel
        </h2>
        <nav className="flex flex-col gap-4">
          <a
            href="/dashboard/users"
            className="px-4 py-2 rounded hover:bg-gray-200 dark:text-gray-50 dark:hover:bg-gray-700"
          >
            Users
          </a>
          <button
            onClick={() => {
              localStorage.removeItem("userToken");
              router.push("/login");
            }}
            className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
          >
            Logout
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 bg-white dark:bg-black">{children}</main>
    </div>
  );
}
