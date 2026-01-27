"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("userToken");

    if (token) {
      // If token exists, redirect to dashboard
      router.replace("/dashboard");
    } else {
      // If no token, redirect to login
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <p className="text-lg text-zinc-600 dark:text-zinc-400">Redirecting...</p>
    </div>
  );
}
