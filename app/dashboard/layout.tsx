"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // NEW: Separate states for mobile drawer and desktop collapse
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const menus = [
    { label: "Dashboard", icon: "🏠", path: "/dashboard" },
    {
      label: "Users",
      icon: "👥",
      isAdminOnly: true,
      subMenu: [{ label: "List Users", path: "/dashboard/users" }],
    },
    {
      label: "Costs",
      icon: "💰",
      isAdminOnly: true,
      subMenu: [
        { label: "Cost Heads", path: "/dashboard/cost-heads" },
        { label: "Custom Cost", path: "/dashboard/custom-costs" },
      ],
    },
    {
      label: "Bazar",
      icon: "🛒",
      isAdminOnly: false,
      subMenu: [
        { label: "Slot", path: "/dashboard/bazar-slots" },
        { label: "Bazar Cost", path: "/dashboard/bazar-costs" },
      ],
    },
    { label: "Add Meal", icon: "🍲", path: "/dashboard/meal/add" },
    {
      label: "Generate Bill",
      icon: "🧾",
      isAdminOnly: true,
      subMenu: [{ label: "Bill Generation", path: "/dashboard/generate-bill" }],
    },
    { label: "Reset Password", icon: "🔑", path: "/dashboard/reset-password" },
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
    setUserName(userData.name || "User");

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

  const toggleSidebar = () => {
    // If mobile, toggle the drawer. If desktop, toggle collapse.
    if (window.innerWidth < 1024) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      setIsDesktopCollapsed(!isDesktopCollapsed);
    }
  };

  if (!isLoaded) return null;

  const filteredMenus = menus.filter(
    (m) => !m.isAdminOnly || userRole === "admin",
  );

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* 1. Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 2. Sidebar */}
      <aside
        className={`bg-blue-700 dark:bg-gray-800 text-white transition-all duration-300 ease-in-out z-50
          fixed inset-y-0 left-0 lg:relative lg:translate-x-0
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isDesktopCollapsed ? "lg:w-20" : "lg:w-64 w-64"}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-blue-600 dark:border-gray-700">
            <span
              className={`font-bold text-xl transition-opacity ${isDesktopCollapsed ? "lg:opacity-0 lg:w-0" : "opacity-100"}`}
            >
              MealApp
            </span>
            <button
              className="lg:hidden text-white"
              onClick={() => setIsMobileOpen(false)}
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 space-y-1 custom-scrollbar">
            {filteredMenus.map((menu) => {
              // Check if any sub-item is active
              const isSubMenuActive = menu.subMenu?.some(
                (sub) => pathname === sub.path,
              );
              // Check if the main menu path is active
              const isMainActive = pathname === menu.path;

              return (
                <div key={menu.label} className="px-3">
                  {menu.subMenu && !isDesktopCollapsed ? (
                    <>
                      <button
                        onClick={() =>
                          setOpenMenus((p) => ({
                            ...p,
                            [menu.label]: !p[menu.label],
                          }))
                        }
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors 
              ${isSubMenuActive ? "bg-blue-600/50 text-white" : "hover:bg-blue-600 text-blue-100"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{menu.icon}</span>
                          <span className="font-medium">{menu.label}</span>
                        </div>
                        <span
                          className={`text-[10px] transition-transform duration-200 ${openMenus[menu.label] ? "rotate-180" : ""}`}
                        >
                          ▼
                        </span>
                      </button>

                      {/* Sub Menu Links */}
                      {openMenus[menu.label] && (
                        <div className="mt-1 ml-4 space-y-1 border-l-2 border-blue-400/30">
                          {menu.subMenu.map((sub) => {
                            const isSubActive = pathname === sub.path;
                            return (
                              <Link
                                key={sub.path}
                                href={sub.path}
                                className={`block p-2 pl-6 text-sm rounded-r-md transition-all
                      ${
                        isSubActive
                          ? "bg-white/10 text-white font-bold border-l-2 border-white -ml-[2px]"
                          : "text-blue-200 hover:text-white hover:bg-blue-600/30"
                      }`}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Single Menu Item or Collapsed Item */
                    <Link
                      href={menu.path || "#"}
                      title={isDesktopCollapsed ? menu.label : ""}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all
            ${
              isMainActive || (isDesktopCollapsed && isSubMenuActive)
                ? "bg-blue-800 text-white shadow-lg ring-1 ring-white/20"
                : "text-blue-100 hover:bg-blue-600"
            }`}
                    >
                      <span className="text-xl">{menu.icon}</span>
                      <span
                        className={`${isDesktopCollapsed ? "lg:hidden" : "block"} font-medium`}
                      >
                        {menu.label}
                      </span>
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t border-blue-600 dark:border-gray-700">
            <button
              onClick={() => {
                localStorage.clear();
                router.push("/login");
              }}
              className="w-full flex items-center justify-center gap-2 p-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-semibold"
            >
              <span>🔒</span> {!isDesktopCollapsed && "Logout"}
            </button>
          </div>
        </div>
      </aside>

      {/* 3. Main Body */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center justify-between px-4 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            {/* COLLAPSE BUTTON - Always visible */}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-200 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="font-semibold text-gray-700 dark:text-gray-200 truncate">
              {userName}&apos;s Portal
            </h1>
          </div>

          <div className="flex items-center gap-3 pr-2">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold ring-2 ring-blue-100">
              {userName[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
