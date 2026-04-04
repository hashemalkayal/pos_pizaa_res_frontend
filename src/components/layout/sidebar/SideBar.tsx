import { type FC } from "react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaClipboardList,
  FaUtensils,
  FaSignOutAlt,
  FaTimes,
  FaChartBar,
  FaMoneyBillWave,
  FaReceipt,
} from "react-icons/fa";
import Logo from "../../../assets/logo.png";

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const userRole = localStorage.getItem("role");

  const baseNavItems = [
    { icon: <FaHome />, label: "Home", path: "/" },
    { icon: <FaClipboardList />, label: "Create Order", path: "/create-order" },
    { icon: <FaUtensils />, label: "Categories", path: "/categories" },

    { icon: <FaReceipt />, label: "Orders History", path: "/orders-history" },

    {
      icon: <FaChartBar />,
      label: "Reports",
      path: "/payments",
      roles: ["ADMIN"],
    },

    {
      icon: <FaMoneyBillWave />,
      label: "Finance",
      path: "/finance",
      roles: ["ADMIN"],
    },
  ];

  const navItems = baseNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole || "")
  );

  const onLogoutClick = () => {
    localStorage.clear();

    navigate("/login");
  };

  return (
    <aside className="h-screen w-56 bg-light border-r border-gray-100 shadow-sm flex flex-col relative">
      {onClose && (
        <div className="absolute top-4 right-4 lg:hidden">
          <Button variant="ghost" onClick={onClose}>
            <FaTimes />
          </Button>
        </div>
      )}

      <div className="p-6 flex justify-center mt-4 lg:mt-0">
        <img src={Logo} alt="Logo" className="object-contain" />
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;

          return (
            <Button
              key={index}
              variant="ghost"
              onClick={() => {
                navigate(item.path);
                onClose?.();
              }}
              className={`w-full flex items-center gap-3 justify-start px-4 py-3 rounded-md text-sm font-medium transition ${
                isActive
                  ? "bg-primary text-dark"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span
                className={`text-lg ${
                  isActive ? "text-dark" : "text-gray-500"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <Button
          onClick={() => {
            onLogoutClick();
            onClose?.();
          }}
          className="w-full bg-primary text-dark hover:bg-primary/90 flex items-center justify-center gap-2 font-semibold"
        >
          <FaSignOutAlt className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
