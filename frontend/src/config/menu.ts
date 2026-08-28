import {
  LayoutDashboard, FileText, Boxes, MonitorSmartphone,
  ShoppingCart, FileClock, RefreshCw, Settings, FolderPlus, ArrowLeftRight, CircleCheck, History,
  FileX, ReceiptText, BookOpen, ShieldCheck

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
    path: "/owner/dashboard/maindashboard", 
    roles: ["OWNER", "ADMIN"] 
  },
  
  // แดชบอร์ดของพนักงาน (ให้เห็นเฉพาะ EMPLOYEE, STAFF)
  { 
    icon: LayoutDashboard, 
    label: "แดชบอร์ด", 
    path: "/employee/dashboard/maindashboard", 
    roles: ["EMPLOYEE", "STAFF"] 
  },

  // เมนูอื่น ๆ ล็อกสิทธิ์ตามที่วางโครงสร้างไว้
  { 
    icon: FileText, 
    label: "นำเข้าสินค้าจากบิล", 
    path: "/owner/import-bills", 
    roles: ["OWNER", "ADMIN"]
  },
  { 
    icon: FileText, 
    label: "นำเข้าสินค้าจากบิล", 
    path: "/employee/import", 
    roles: ["EMPLOYEE", "STAFF"]
  },
  { icon: Boxes, label: "คลังสินค้า", path: "/owner/stock", roles: ["OWNER", "ADMIN"],
    subs: [
      { icon: ArrowLeftRight, path: "/owner/stock/stock-movement", label: "การเคลื่อนไหวของคลังสินค้า" },
      { icon: FolderPlus, path: "/owner/stock/stock-data", label: "สร้างข้อมูลสินค้า" },
      { icon: CircleCheck, path: "/owner/stock/stock-check", label: "ตรวจสอบสินค้า"},
    ],
  },
  // งานเช็คสต็อกที่มอบหมายให้พนักงาน (เห็นเฉพาะ EMPLOYEE, STAFF)
  { icon: Boxes, label: "คลังสินค้า", path: "/employee/wms/stock-data", roles: ["EMPLOYEE", "STAFF"],
    subs: [
      { icon: CircleCheck, path: "/employee/wms/check-stock", label: "เช็คสต็อกสินค้า" },
    ],
   },
  // POS
  { icon: MonitorSmartphone, label: "ระบบขาย POS", path: "/employee/pos/pos", roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"], 
    subs: [
      { icon: History, path: "/employee/pos/sales_history", label: "ประวัติการขาย" },
      { icon: FileX, path: "/employee/pos/sales_cancellation_history", label: "ประวัติยกเลิกการขาย" },
    ],
  },
  // รายการธุรกรรม / การเงิน
  { icon: ReceiptText, label: "รายการธุรกรรม / การเงิน", path: "/employee/transactions/settle-bills", roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"],
    subs: [
      { icon: History, path: "/employee/transactions/payment-history", label: "ประวัติการชำระเงิน" },
      { icon: FileX, path: "/employee/transactions/payment-cancellation-history", label: "ประวัติยกเลิกการชำระเงิน" },
    ],
  },

  // ข้อมูลลูกค้า
  { icon: FolderPlus, label: "ข้อมูลลูกค้า", path: "/employee/customers/customer-registration", roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"],},


  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/owner/orders", roles: ["OWNER", "ADMIN"] },
  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/employee/orders", roles: ["EMPLOYEE"] },
  { 
    icon: FileClock, 
    label: "พรีออเดอร์", 
    path: "/owner/pre-orders", 
    roles: ["OWNER", "ADMIN"],
    subs: [
      { icon: FileClock, path: "/owner/pre-orders", label: "รายการสั่งจองสินค้า" },
      { icon: BookOpen, path: "/owner/pre-orders/catalog", label: "แคตตาล็อกสินค้า" },
    ]
  },
  { 
    icon: FileClock, 
    label: "พรีออเดอร์", 
    path: "/employee/pre-orders", 
    roles: ["EMPLOYEE", "STAFF"],
    subs: [
      { icon: FileClock, path: "/employee/pre-orders", label: "รายการสั่งจองสินค้า" },
      { icon: BookOpen, path: "/employee/pre-orders/catalog", label: "แคตตาล็อกสินค้า" },
    ]
  },
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

  { icon: Settings, label: "การตั้งค่า", path: "/owner/storeconfig", roles: ["OWNER", "ADMIN"],
   subs: [
      { icon: ShieldCheck, path: "/owner/storeconfig/financial-policy", label: "นโยบายการเงิน" },
    ],
  },
];

/**
 * ดึงรายการเมนู Sidebar ที่เปิดสิทธิ์ให้ใช้งานตาม Role ผู้เล่น
 * และสลับ Route Path ของเมนูย่อยให้อัตโนมัติตามสิทธิ์ (OWNER/ADMIN vs EMPLOYEE/STAFF)
 */
export const getMenuByRole = (role: string): MenuItem[] => {
  const currentRole = role.toUpperCase();
  const isOwnerOrAdmin = currentRole === "OWNER" || currentRole === "ADMIN";

  return SIDEBAR_MENUS
    // 1. กรองเมนูหลักตามสิทธิ์ของ Role
    .filter((menu) => menu.roles.includes(currentRole))
    // 2. ปรับแต่ง Path ของเมนูย่อยให้ตรงตาม Role
    .map((menu) => {
      let updatedMenu = { ...menu };

      // 1. สลับ Main Path ของ POS ตาม Role
      if (menu.path.includes("/pos/pos")) {
        updatedMenu.path = isOwnerOrAdmin ? "/owner/pos/pos" : "/employee/pos/pos";
      }

      // 2. สลับ Main Path ของ รายการธุรกรรม ตาม Role
      if (menu.path.includes("/transactions/settle-bills")) {
        updatedMenu.path = isOwnerOrAdmin
          ? "/owner/transactions/settle-bills"
          : "/employee/transactions/settle-bills";
      }

      // 3. สลับ Main Path ของ คืน และ เคลมสินค้า ตาม Role
      if (menu.path.includes("/claims") || menu.path.includes("/returns")) {
        updatedMenu.path = isOwnerOrAdmin ? "/owner/claims" : "/employee/claims";
      }

      if (menu.path.includes("/customer-registration")) {
        updatedMenu.path = isOwnerOrAdmin
          ? "/owner/customers/customer-registration"
          : "/employee/customers/customer-registration";
      }

      if (!updatedMenu.subs) return updatedMenu;

      // 4. สลับ Sub-menu Path & Label ตาม Role
      return {
        ...updatedMenu,
        subs: updatedMenu.subs.map((sub) => {
          if (sub.path.includes("sales_cancellation_history")) {
            return {
              ...sub,
              label: isOwnerOrAdmin ? "คำขอยกเลิกบิล" : "ประวัติยกเลิกการขาย",
              path: isOwnerOrAdmin
                ? "/owner/pos/sales_cancellation_history"
                : "/employee/pos/sales_cancellation_history",
            };
          }

          if (sub.path.includes("sales_history")) {
            return {
              ...sub,
              path: isOwnerOrAdmin
                ? "/owner/pos/sales_history"
                : "/employee/pos/sales_history",
            };
          }

          if (sub.path.includes("payment-history")) {
            return {
              ...sub,
              path: isOwnerOrAdmin
                ? "/owner/transactions/payment-history"
                : "/employee/transactions/payment-history",
            };
          }

          if (sub.path.includes("payment-cancellation-history")) {
            return {
              ...sub,
              label: isOwnerOrAdmin ? "คำขอยกเลิกการชำระเงิน" : "ประวัติยกเลิกการชำระเงิน",
              path: isOwnerOrAdmin
                ? "/owner/transactions/payment-cancellation-history"
                : "/employee/transactions/payment-cancellation-history",
            };
          }

          if (sub.path.includes("claims")) {
            return {
              ...sub,
              path: isOwnerOrAdmin ? "/owner/claims" : "/employee/claims",
            };
          }

          if (sub.path.includes("returns")) {
            return {
              ...sub,
              path: isOwnerOrAdmin ? "/owner/returns" : "/employee/returns",
            };
          }

          return sub;
        }),
      };
    });
};