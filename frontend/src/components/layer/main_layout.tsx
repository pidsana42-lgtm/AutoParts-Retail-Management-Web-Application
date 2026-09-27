import React, { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./sidebar";
import Navbar from "./navbar";
import { setLastValidPath } from "../../utils/navigationAuth";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({
  children,
}: MainLayoutProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    // Track valid base pages (excluding routes with IDs which are tracked upon authorization)
    const isIdRoute = /\/\d+(?:\/[a-zA-Z_-]+)?$/.test(location.pathname);
    if (!isIdRoute) {
      setLastValidPath(location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  const handleToggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className="flex bg-white h-screen overflow-hidden select-none">
      <Sidebar collapsed={collapsed} onToggle={handleToggleSidebar} />
      <div className="flex-1 flex flex-col h-full min-w-0">
        <Navbar />

        <main className="flex-1 overflow-y-auto bg-gray-50"> {children}</main>
      </div>
    </div>
  );
}
