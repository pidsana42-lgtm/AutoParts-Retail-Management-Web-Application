import {
  LayoutDashboard, FileText, Boxes, MonitorSmartphone,
  ShoppingCart, FileClock, RefreshCw, Settings, FolderPlus, ArrowLeftRight, History
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MenuSubItem {
  icon?: LucideIcon;
  label: string;
  path: string;
}

export interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles: string[]; 
  subs?: MenuSubItem[];
  subPath?: string;
  subLabel?: string;
  subIcon?: LucideIcon;

}

export const SIDEBAR_MENUS: MenuItem[] = [
  // แดชบอร์ดของเจ้าของร้าน (ให้เห็นเฉพาะ OWNER, ADMIN)
  { 
    icon: LayoutDashboard, 
    label: "แดชบอร์ด", 
    path: "/owner/dashboard/", 
    roles: ["OWNER", "ADMIN"] 
  },
  
  // แดชบอร์ดของพนักงาน (ให้เห็นเฉพาะ EMPLOYEE, STAFF)
  { 
    icon: LayoutDashboard, 
    label: "แดชบอร์ด", 
    path: "/employee/dashboard", 
    roles: ["EMPLOYEE", "STAFF"] 
  },

  // เมนูอื่น ๆ ล็อกสิทธิ์ตามที่วางโครงสร้างไว้
  { icon: FileText, label: "นำเข้าสินค้าจากบิล", path: "/owner/import-bills", roles: ["OWNER", "ADMIN"] },
  { icon: Boxes, label: "คลังสินค้า", path: "/owner/stock", roles: ["OWNER", "ADMIN"], 
    subs: [
      { icon: ArrowLeftRight, path: "/owner/stock/stock-movement", label: "การเคลื่อนไหวของคลังสินค้า" },
      { icon: FolderPlus, path: "/owner/stock/stock-data", label: "สร้างข้อมูลสินค้า" },

    ],
  },
  // POS
  { icon: MonitorSmartphone, label: "ระบบขาย POS", path: "/employee/pos/pos", roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"], 
    subs: [
      { icon: History, path: "/employee/pos/sales_history", label: "รายการธุรกรรม" },
    ],
  },
  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/owner/orders", roles: ["OWNER", "ADMIN"] },
  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/employee/orders", roles: ["EMPLOYEE"] },
  { icon: FileClock, label: "พรีออเดอร์", path: "/owner/pre-orders", roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"] },
  { 
    icon: RefreshCw, 
    label: "คืน และ เคลมสินค้า", 
    path: "/owner/claims", 
    roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"],
    subs: [
      { label: "รายการเคลมสินค้า", path: "/owner/claims", icon: FileText },
      { label: "รายการคืนสินค้า", path: "/owner/returns", icon: RefreshCw }
    ]
  },
  { 
    icon: Settings, 
    label: "การตั้งค่า", 
    path: "/owner/storeconfig", 
    roles: ["OWNER", "ADMIN"],
    subs: [
      { path: "/owner/storeconfig", label: "จัดการสิทธิ์ส่วนลดลูกค้าอู่" },
    ],
  },
];

// ใครมีชื่อในอาเรย์ roles ของปุ่มนั้น ถึงจะโชว์บนหน้าจอ
export const getMenuByRole = (role: string): MenuItem[] => {
  const currentRole = role.toUpperCase();
  return SIDEBAR_MENUS.filter((menu) => menu.roles.includes(currentRole));
};
