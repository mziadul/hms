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
  icon?: string;
  path?: string;
  subMenu?: SubMenuItem[];
  isAdminOnly?: boolean; // নতুন প্রপার্টি: শুধু এডমিনদের জন্য কি না
}

export default function DashboardLayout({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // ১. মেনু ডেফিনেশন (isAdminOnly ফ্ল্যাগসহ)
  const menus: MenuItem[] = [
    {
      label: "Dashboard",
      icon: "🏠",
      path: "/dashboard",
    },
    {
      label: "Users",
      icon: "👥",
      isAdminOnly: true, // Restricted
      subMenu: [
        { label: "List Users", path: "/dashboard/users" },
        { label: "Add User", path: "/dashboard/users/add" },
      ],
    },
    {
      label: "Cost Heads",
      icon: "💰",
      isAdminOnly: true, // Restricted
      subMenu: [
        { label: "List Cost Heads", path: "/dashboard/cost-heads" },
        { label: "Add Cost Head", path: "/dashboard/cost-heads/add" },
      ],
    },
    {
      label: "Generate Bill",
      icon: "🧾",
      isAdminOnly: true, // Restricted
      subMenu: [{ label: "Bill Generation", path: "/dashboard/generate-bill" }],
    },
    {
      label: "Add Meal",
      icon: "🍲",
      path: "/dashboard/meal/add", // সবার জন্য উন্মুক্ত
    },
  ];

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    const info = localStorage.getItem("userInfo");

    if (!token || !info) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(info);
    setUserRole(userData.type);

    // ২. অ্যাক্সেস কন্ট্রোল লজিক:
    // যদি সাধারণ ইউজার এডমিন ইউআরএল এ ঢোকার চেষ্টা করে, ড্যাশবোর্ডে পাঠিয়ে দাও
    const currentMenu = menus.find(
      (m) => m.path === pathname || m.subMenu?.some((s) => s.path === pathname),
    );

    if (userData.type !== "admin" && currentMenu?.isAdminOnly) {
      router.push("/dashboard");
    }

    // মেনু অটো-এক্সপ্যান্ড লজিক
    const newOpenMenus: Record<string, boolean> = {};
    menus.forEach((menu) => {
      if (menu.subMenu) {
        newOpenMenus[menu.label] = menu.subMenu.some((sub) =>
          pathname?.startsWith(sub.path),
        );
      }
    });
    setOpenMenus(newOpenMenus);
    setIsLoaded(true);
  }, [pathname, router]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) => pathname === path;

  const menuItemClass = (path: string) =>
    `px-4 py-2 rounded hover:bg-blue-600 transition-colors ${
      isActive(path) ? "bg-blue-800 font-bold" : ""
    }`;

  // ৩. সাইডবার ফিল্টারিং লজিক
  const filteredMenus = menus.filter((menu) => {
    if (menu.isAdminOnly && userRole !== "admin") return false;
    return true;
  });

  if (!isLoaded) return null; // হাইড্রেশন এরর এড়াতে

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-blue-600 to-blue-800 dark:from-gray-800 dark:to-gray-900 text-white p-6 flex flex-col shadow-xl">
        <h2 className="text-2xl font-bold mb-6 border-b border-blue-400 pb-4">
          {userRole === "admin" ? "Admin Panel" : "User Panel"}
        </h2>

        <nav className="flex flex-col gap-2">
          {filteredMenus.map((menu) => (
            <div key={menu.label}>
              {menu.subMenu ? (
                <>
                  <button
                    onClick={() => toggleMenu(menu.label)}
                    className={`w-full flex justify-between items-center px-4 py-2 rounded hover:bg-blue-500 transition-colors ${
                      openMenus[menu.label] ? "bg-blue-700 font-bold" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {menu.icon} {menu.label}
                    </span>
                    <span className="text-xs">
                      {openMenus[menu.label] ? "▲" : "▼"}
                    </span>
                  </button>

                  {openMenus[menu.label] && (
                    <div className="flex flex-col ml-6 mt-1 gap-1 border-l border-blue-400">
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
                  className={`flex items-center gap-2 px-4 py-2 rounded hover:bg-blue-500 transition-colors ${
                    isActive(menu.path!) ? "bg-blue-700 font-bold" : ""
                  }`}
                >
                  {menu.icon} {menu.label}
                </Link>
              )}
            </div>
          ))}

          <button
            onClick={() => {
              localStorage.removeItem("userToken");
              localStorage.removeItem("userInfo");
              router.push("/login");
            }}
            className="mt-8 px-4 py-2 rounded bg-red-500 hover:bg-red-600 transition-all font-semibold shadow-md"
          >
            Logout 🔒
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-50 overflow-y-auto">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
