"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface Props {
  children: React.ReactNode;
}

interface SubMenuItem {
  label: string;
  path: string;
}

interface MenuItem {
  label: string;
  icon?: string; // optional emoji or icon
  path?: string; // direct link if no subMenu
  subMenu?: SubMenuItem[];
}

export default function DashboardLayout({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Define your menus here
  const menus: MenuItem[] = [
    {
      label: "Dashboard",
      icon: "🏠",
      path: "/dashboard",
    },
    {
      label: "Users",
      icon: "👥",
      subMenu: [
        { label: "List Users", path: "/dashboard/users" },
        { label: "Add User", path: "/dashboard/users/add" },
      ],
    },
    {
      label: "Cost Heads",
      icon: "💰",
      subMenu: [
        { label: "List Cost Heads", path: "/dashboard/cost-heads" },
        { label: "Add Cost Head", path: "/dashboard/cost-heads/add" },
      ],
    },
    {
      label: "Generate Bill",
      icon: "💰",
      subMenu: [
        { label: "Bill Generation", path: "/dashboard/generate-bill" }
      ],
    },
    {
      label: "Add Meal",
      icon: "🍲",
      path: "/dashboard/meal/add",
    }
    // Add more menus here dynamically if needed
  ];

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      router.push("/login");
    }

    // Expand menus automatically if pathname matches
    const newOpenMenus: Record<string, boolean> = {};
    menus.forEach((menu) => {
      if (menu.subMenu) {
        newOpenMenus[menu.label] = menu.subMenu.some((sub) =>
          pathname?.startsWith(sub.path)
        );
      }
    });
    setOpenMenus(newOpenMenus);
  }, [pathname, router]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

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
          {menus.map((menu) => (
            <div key={menu.label}>
              {menu.subMenu ? (
                <>
                  <button
                    onClick={() => toggleMenu(menu.label)}
                    className={`w-full flex justify-between items-center px-4 py-2 rounded hover:bg-blue-600 transition-colors ${
                      openMenus[menu.label] ? "bg-blue-800 font-bold" : ""
                    }`}
                  >
                    <span>
                      {menu.icon} {menu.label}
                    </span>
                    <span>{openMenus[menu.label] ? "▲" : "▼"}</span>
                  </button>

                  {openMenus[menu.label] && (
                    <div className="flex flex-col ml-4 mt-1 gap-1">
                      {menu.subMenu.map((sub) => (
                        <Link
                          key={sub.path}
                          href={sub.path}
                          className={menuItemClass(sub.path)}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={menu.path!}
                  className={`px-4 py-2 rounded hover:bg-blue-600 transition-colors ${
                    isActive(menu.path!) ? "bg-blue-800 font-bold" : ""
                  }`}
                >
                  {menu.icon} {menu.label}
                </Link>
              )}
            </div>
          ))}

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
