import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/component";

export interface BreadcrumbItem {
  label: string;
  // path: ใส่ไว้ = คลิกได้ (ลิงก์กลับไปหน้านั้น) — ไม่ใส่ (หรือเป็นรายการสุดท้าย) = หน้าปัจจุบัน ไม่ใช่ลิงก์
  path?: string;
  state?: unknown;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

// เส้นทางเกล็ดขนมปัง (breadcrumb) ใช้ร่วมกันทุกหน้าในระบบ WMS — ให้เห็นว่าอยู่ตรงไหนของระบบ
// และย้อนกลับไปหน้าก่อนหน้าได้ทีละขั้นโดยไม่ต้องพึ่งปุ่มย้อนกลับ/ปุ่ม back ของเบราว์เซอร์
export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className={cn("flex flex-wrap items-center gap-1.5 text-xs text-slate-400", className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const idMatch = item.path ? item.path.match(/\/(\d+)(?:\/[a-zA-Z_-]+)?$/) : null;
        const linkState = item.state ?? (idMatch ? { authorizedId: Number(idMatch[1]) } : undefined);
        return (
          <span key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />}
            {item.path && !isLast ? (
              <Link to={item.path} state={linkState} className="transition-colors hover:text-[#B70011] hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-slate-600" : ""}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
