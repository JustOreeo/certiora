"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Admin login is now unified at /login
export default function AdminLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
