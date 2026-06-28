import React, { useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "./sidebar";
import Navbar from "./navbar";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({
  children,
}: MainLayoutProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const handleToggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className="flex bg-[#f8f9fa] h-screen overflow-hidden font-sans select-none">
      <Sidebar collapsed={collapsed} onToggle={handleToggleSidebar} />
      <div className="flex-1 flex flex-col h-full min-w-0">
        <Navbar />

        <main className="flex-1 p-6 overflow-y-auto bg-[#F3F4F6]">
          {children}
        </main>
      </div>
    </div>
  );
}
