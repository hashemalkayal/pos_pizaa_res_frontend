import type { FC } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../sidebar/SideBar";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FaBars } from "react-icons/fa";

const MainLayout: FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-light text-dark overflow-hidden">
      {/* Sidebar - hidden on small screens unless open */}
      <div
        className={`fixed z-40 transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setMobileOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden h-14 bg-white flex items-center px-4 shadow z-30">
          <Button variant="ghost" onClick={() => setMobileOpen(true)}>
            <FaBars className="text-xl" />
          </Button>
          <h1 className="ml-4 text-lg font-semibold">Dashboard</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-light z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
