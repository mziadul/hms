"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [usersMenuOpen, setUsersMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      router.push("/login");
    }

    // Expand Users menu if current path is under /dashboard/users
    if (pathname?.startsWith("/dashboard/users")) {
      setUsersMenuOpen(true);
    }
  }, [pathname, router]);

  const isActive = (path: string) => pathname === path;

  const menuItemClass = (path: string) =>
    `px-4 py-2 rounded hover:bg-blue-600 transition-colors ${
      isActive(path) ? "bg-blue-800 font-bold" : ""
    }`;

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-blue-500 to-blue-700 dark:from-gray-800 dark:to-gray-900 text-white p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-6">Admin Panel</h2>

        <nav className="flex flex-col gap-2">
          {/* Single menu item */}
          <Link
            href="/dashboard"
            className={`px-4 py-2 rounded hover:bg-blue-600 transition-colors ${
              isActive("/dashboard") ? "bg-blue-800 font-bold" : ""
            }`}
          >
            Dashboard 🏠
          </Link>

          {/* Nested menu */}
          <div>
            <button
              onClick={() => setUsersMenuOpen(!usersMenuOpen)}
              className={`w-full flex justify-between items-center px-4 py-2 rounded hover:bg-blue-600 transition-colors ${
                pathname?.startsWith("/dashboard/users")
                  ? "bg-blue-800 font-bold"
                  : ""
              }`}
            >
              Users 👥
              <span className="ml-2">{usersMenuOpen ? "▲" : "▼"}</span>
            </button>

            {usersMenuOpen && (
              <div className="flex flex-col ml-4 mt-1 gap-1">
                <Link
                  href="/dashboard/users"
                  className={menuItemClass("/dashboard/users")}
                >
                  List Users
                </Link>
                <Link
                  href="/dashboard/users/add"
                  className={menuItemClass("/dashboard/users/add")}
                >
                  Add User
                </Link>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={() => {
              localStorage.removeItem("userToken");
              router.push("/login");
            }}
            className="mt-4 px-4 py-2 rounded bg-red-500 hover:bg-red-600 transition-colors"
          >
            Logout 🔒
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-50">
        {children}
      </main>
    </div>
  );
}
