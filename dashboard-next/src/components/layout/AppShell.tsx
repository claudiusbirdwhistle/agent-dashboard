"use client";

import { usePathname } from "next/navigation";
import Shell from "./Shell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  return <Shell>{children}</Shell>;
}
