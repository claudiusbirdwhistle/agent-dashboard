"use client";

import { useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";

interface ShellProps {
  children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar: overlay on mobile, static on desktop */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-52 transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0 md:transition-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar onNavigate={closeSidebar} />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <Header onMenuToggle={toggleSidebar} />
        {/* pb-16 on mobile to clear BottomNav */}
        <main className="flex-1 min-h-0 overflow-auto flex flex-col pb-16 md:pb-0">{children}</main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <BottomNav />
    </div>
  );
}
