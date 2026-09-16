import {
  LayoutDashboard, FileText, Boxes, MonitorSmartphone,
  ShoppingCart, FileClock, RefreshCw, Settings, FolderPlus, ArrowLeftRight, CircleCheck, History,
  FileX, ReceiptText, BookOpen, ShieldCheck, UserCheck, RotateCcw
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
  // แดชบอร์ดของเจ้าของร้าน
  { 
    icon: LayoutDashboard, 
    label: "แดชบอร์ด", 
    path: "/owner/dashboard/maindashboard", 
    roles: ["OWNER"] 
  },
  // แดชบอร์ดของจัดการร้าน (Manager)
  { 
    icon: LayoutDashboard, 
    label: "แดชบอร์ด", 
    path: "/manager/dashboard/maindashboard", 
    roles: ["MANAGER"] 
  },
  // แดชบอร์ดของพนักงาน
  { 
    icon: LayoutDashboard, 
    label: "แดชบอร์ด", 
    path: "/employee/dashboard/maindashboard", 
    roles: ["EMPLOYEE"]
  },

  // นำเข้าสินค้า
  { icon: FileText, label: "นำเข้าสินค้าจากบิล", path: "/owner/import-bills", roles: ["OWNER"] },
  { icon: FileText, label: "นำเข้าสินค้าจากบิล", path: "/manager/import-bills", roles: ["MANAGER"] },
  { icon: FileText, label: "นำเข้าสินค้าจากบิล", path: "/employee/import", roles: ["EMPLOYEE", "STAFF"] },

  // คลังสินค้า
  { icon: Boxes, label: "คลังสินค้า", path: "/owner/stock", roles: ["OWNER"],
    subs: [
      { icon: ArrowLeftRight, path: "/owner/stock/stock-movement", label: "การเคลื่อนไหวของคลังสินค้า" },
      { icon: FolderPlus, path: "/owner/stock/stock-data", label: "การตั้งค่าข้อมูลสินค้า" },
      { icon: CircleCheck, path: "/owner/stock/stock-check", label: "ตรวจสอบสินค้า"},
    ],
  },
  { icon: Boxes, label: "คลังสินค้า", path: "/manager/stock", roles: ["MANAGER"],
    subs: [
      { icon: ArrowLeftRight, path: "/manager/stock/stock-movement", label: "การเคลื่อนไหวของคลังสินค้า" },
      { icon: FolderPlus, path: "/manager/stock/stock-data", label: "การตั้งค่าข้อมูลสินค้า" },
      { icon: CircleCheck, path: "/manager/stock/stock-check", label: "ตรวจสอบสินค้า"},
    ],
  },
  { icon: Boxes, label: "คลังสินค้า", path: "/employee/wms/stock-data", roles: ["EMPLOYEE", "STAFF"],
    subs: [
      { icon: CircleCheck, path: "/employee/wms/check-stock", label: "ตรวจสอบสินค้า" },
    ],
   },

  // POS
  { icon: MonitorSmartphone, label: "ระบบขาย POS", path: "/employee/pos/pos", roles: ["OWNER", "MANAGER", "EMPLOYEE", "STAFF"], 
    subs: [
      { icon: History, path: "/employee/pos/sales_history", label: "ประวัติการขาย" },
      { icon: FileX, path: "/employee/pos/sales_cancellation_history", label: "ประวัติยกเลิกการขาย" },
    ],
  },

  // รายการธุรกรรม / การเงิน
  { icon: ReceiptText, label: "รายการธุรกรรม / การเงิน", path: "/employee/transactions/settle-bills", roles: ["OWNER", "MANAGER", "EMPLOYEE", "STAFF"],
    subs: [
      { icon: History, path: "/employee/transactions/payment-history", label: "ประวัติการชำระเงิน" },
      { icon: FileX, path: "/employee/transactions/payment-cancellation-history", label: "ประวัติยกเลิกการชำระเงิน" },
    ],
  },

  // ข้อมูลลูกค้า
  { icon: FolderPlus, label: "ข้อมูลลูกค้า", path: "/employee/customers/customer-registration", roles: ["OWNER", "MANAGER", "EMPLOYEE", "STAFF"] },

  // สั่งซื้อ
  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/owner/orders", roles: ["OWNER"],
    subs: [{ icon: RotateCcw, path: "/owner/orders/restore", label: "กู้คืนใบสั่งซื้อ" }],
   },
  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/manager/orders", roles: ["MANAGER"],
    subs: [{ icon: RotateCcw, path: "/manager/orders/restore", label: "กู้คืนใบสั่งซื้อ" }],
   },
  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/employee/orders", roles: ["EMPLOYEE"],
    subs: [{ icon: RotateCcw, path: "/employee/orders/restore", label: "กู้คืนใบสั่งซื้อ" }],
   },

  // พรีออเดอร์
  { 
    icon: FileClock, label: "พรีออเดอร์", path: "/owner/pre-orders", roles: ["OWNER"],
    subs: [
      { icon: FileClock, path: "/owner/pre-orders", label: "รายการสั่งจองสินค้า" },
      { icon: BookOpen, path: "/owner/pre-orders/catalog", label: "แคตตาล็อกสินค้า" },
    ]
  },
  { 
    icon: FileClock, label: "พรีออเดอร์", path: "/manager/pre-orders", roles: ["MANAGER"],
    subs: [
      { icon: FileClock, path: "/manager/pre-orders", label: "รายการสั่งจองสินค้า" },
      { icon: BookOpen, path: "/manager/pre-orders/catalog", label: "แคตตาล็อกสินค้า" },
    ]
  },
  { 
    icon: FileClock, label: "พรีออเดอร์", path: "/employee/pre-orders", roles: ["EMPLOYEE", "STAFF"],
    subs: [
      { icon: FileClock, path: "/employee/pre-orders", label: "รายการสั่งจองสินค้า" },
      { icon: BookOpen, path: "/employee/pre-orders/catalog", label: "แคตตาล็อกสินค้า" },
    ]
  },

  // คืน และ เคลมสินค้า
  { 
    icon: RefreshCw, label: "คืน และ เคลมสินค้า", path: "/owner/claims", roles: ["OWNER"],
    subs: [
      { label: "รายการเคลมสินค้า", path: "/owner/claims", icon: FileText },
      { label: "รายการคืนสินค้า", path: "/owner/returns", icon: RefreshCw }
    ]
  },
  { 
    icon: RefreshCw, label: "คืน และ เคลมสินค้า", path: "/manager/claims", roles: ["MANAGER"],
    subs: [
      { label: "รายการเคลมสินค้า", path: "/manager/claims", icon: FileText },
      { label: "รายการคืนสินค้า", path: "/manager/returns", icon: RefreshCw }
    ]
  },
  { 
    icon: RefreshCw, label: "คืน และ เคลมสินค้า", path: "/employee/claims", roles: ["EMPLOYEE", "STAFF"],
    subs: [
      { label: "รายการเคลมสินค้า", path: "/employee/claims", icon: FileText },
      { label: "รายการคืนสินค้า", path: "/employee/returns", icon: RefreshCw }
    ]
  },

  // การตั้งค่า
  { icon: Settings, label: "การตั้งค่า", path: "/owner/storeconfig", roles: ["OWNER"],
   subs: [
      { icon: ShieldCheck, path: "/owner/storeconfig/financial-policy", label: "นโยบายการเงิน" },
      { icon: UserCheck, path: "/owner/storeconfig/customer-credit-control", label: "การควบคุมเครดิตลูกค้า" },
    ],
  },
  { icon: Settings, label: "การตั้งค่า", path: "/manager/storeconfig", roles: ["MANAGER"],
   subs: [
      { icon: ShieldCheck, path: "/manager/storeconfig/financial-policy", label: "นโยบายการเงิน" },
      { icon: UserCheck, path: "/manager/storeconfig/customer-credit-control", label: "การควบคุมเครดิตลูกค้า" },
    ],
  },
];

/**
 * ดึงรายการเมนู Sidebar ที่เปิดสิทธิ์ให้ใช้งานตาม Role ผู้เล่น
 * แยกสิทธิ์ระหว่าง OWNER และ MANAGER อย่างชัดเจน
 */
export const getMenuByRole = (role: string): MenuItem[] => {
  const normalized = role.toUpperCase();
  const currentRole = normalized === "ADMIN" ? "MANAGER" : normalized;
  const isOwnerOrManager = currentRole === "OWNER" || currentRole === "MANAGER";
  const rolePrefix = currentRole === "MANAGER" ? "/manager" : isOwnerOrManager ? "/owner" : "/employee";

  return SIDEBAR_MENUS
    // 1. กรองเมนูหลักตามสิทธิ์ของ Role
    .filter((menu) => menu.roles.includes(currentRole))
    // 2. ปรับแต่ง Path ของเมนูย่อยให้ตรงตาม Role
    .map((menu) => {
      let updatedMenu = { ...menu };

      // ถ้าเป็น Manager ให้แปลง path หลักที่ขึ้นต้นด้วย /owner ให้เป็น /manager
      if (currentRole === "MANAGER" && updatedMenu.path.startsWith("/owner")) {
        updatedMenu.path = updatedMenu.path.replace(/^\/owner/, "/manager");
      }

      // 1. สลับ Main Path ของ POS ตาม Role
      if (menu.path.includes("/pos/pos")) {
        updatedMenu.path = isOwnerOrManager ? `${rolePrefix}/pos/pos` : "/employee/pos/pos";
      }

      // 2. สลับ Main Path ของ รายการธุรกรรม ตาม Role
      if (menu.path.includes("/transactions/settle-bills")) {
        updatedMenu.path = isOwnerOrManager
          ? `${rolePrefix}/transactions/settle-bills`
          : "/employee/transactions/settle-bills";
      }

      // 3. สลับ Main Path ของ คืน และ เคลมสินค้า ตาม Role
      if (menu.path.includes("/claims") || menu.path.includes("/returns")) {
        updatedMenu.path = isOwnerOrManager ? `${rolePrefix}/claims` : "/employee/claims";
      }

      if (menu.path.includes("/customer-registration")) {
        updatedMenu.path = isOwnerOrManager
          ? `${rolePrefix}/customers/customer-registration`
          : "/employee/customers/customer-registration";
      }

      if (!updatedMenu.subs) return updatedMenu;

      // 4. สลับ Sub-menu Path & Label ตาม Role
      return {
        ...updatedMenu,
        subs: updatedMenu.subs.map((sub) => {
          let updatedSub = { ...sub };

          // ถ้าเป็น Manager ให้แปลง sub path ที่ขึ้นต้นด้วย /owner ให้เป็น /manager
          if (currentRole === "MANAGER" && updatedSub.path.startsWith("/owner")) {
            updatedSub.path = updatedSub.path.replace(/^\/owner/, "/manager");
          }

          if (sub.path.includes("sales_cancellation_history")) {
            return {
              ...updatedSub,
              label: isOwnerOrManager ? "คำขอยกเลิกบิล" : "ประวัติยกเลิกการขาย",
              path: isOwnerOrManager
                ? `${rolePrefix}/pos/sales_cancellation_history`
                : "/employee/pos/sales_cancellation_history",
            };
          }

          if (sub.path.includes("sales_history")) {
            return {
              ...updatedSub,
              path: isOwnerOrManager
                ? `${rolePrefix}/pos/sales_history`
                : "/employee/pos/sales_history",
            };
          }

          if (sub.path.includes("payment-history")) {
            return {
              ...updatedSub,
              path: isOwnerOrManager
                ? `${rolePrefix}/transactions/payment-history`
                : "/employee/transactions/payment-history",
            };
          }

          if (sub.path.includes("payment-cancellation-history")) {
            return {
              ...updatedSub,
              label: isOwnerOrManager ? "คำขอยกเลิกการชำระเงิน" : "ประวัติยกเลิกการชำระเงิน",
              path: isOwnerOrManager
                ? `${rolePrefix}/transactions/payment-cancellation-history`
                : "/employee/transactions/payment-cancellation-history",
            };
          }

          if (sub.path.includes("claims")) {
            return {
              ...updatedSub,
              path: isOwnerOrManager ? `${rolePrefix}/claims` : "/employee/claims",
            };
          }

          if (sub.path.includes("returns")) {
            return {
              ...updatedSub,
              path: isOwnerOrManager ? `${rolePrefix}/returns` : "/employee/returns",
            };
          }

          return updatedSub;
        }),
      };
    });
};
