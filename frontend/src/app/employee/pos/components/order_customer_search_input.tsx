import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ScanBarcode, User, FileText, Loader2, X } from "lucide-react";
import Input from "../../../../components/elements/input";
import Badge from "../../../../components/elements/badge";
import Text from "../../../../components/elements/text";
import { posApiService } from "../../../../service/http/pos/pos_service";
import { cn } from "../../../../utils/component";
import type { CustomerDiscountResponse } from "../../../../interface/pos/customer_interface";

export interface SuggestionOrder {
  id: number;
  order_number: string;
  customer_name?: string;
  total_amount?: number;
  status?: string;
  order_date?: string;
}

export interface OrderCustomerSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customerName: string, customer?: CustomerDiscountResponse) => void;
  onSelectOrder?: (orderNumber: string, order?: SuggestionOrder) => void;
  onSubmit?: () => void;
  placeholder?: string;
  orderSectionTitle?: string;
  customerSectionTitle?: string;
  fetchOrders?: (query: string) => Promise<SuggestionOrder[]>;
  fetchCustomers?: (query: string) => Promise<CustomerDiscountResponse[]>;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  icon?: React.ReactNode;
}

const getCustomerTypeVariant = (typeName?: string): any => {
  const t = (typeName || "").toUpperCase();
  if (t.includes("GARAGE") || t.includes("อู่")) return "garage";
  if (t.includes("WHOLESALE") || t.includes("บริษัท")) return "wholesale";
  if (t.includes("GENERAL") || t.includes("ทั่วไป")) return "customer";
  return "neutral";
};

const getOrderStatusVariant = (status?: string): any => {
  const s = (status || "").toUpperCase();
  if (s === "COMPLETED" || s === "เสร็จสมบูรณ์") return "success";
  if (s === "PENDING_CANCEL" || s === "PENDING" || s.includes("รอ")) return "warning";
  if (s === "CANCELLED" || s === "REJECTED" || s.includes("ยกเลิก") || s.includes("ปฏิเสธ")) return "error";
  return "neutral";
};

const getOrderStatusLabel = (status?: string): string => {
  const s = (status || "").toUpperCase();
  if (s === "COMPLETED") return "เสร็จสมบูรณ์";
  if (s === "PENDING_CANCEL") return "รออนุมัติยกเลิก";
  if (s === "PENDING") return "รอดำเนินการ";
  if (s === "CANCELLED") return "ยกเลิกแล้ว";
  if (s === "REJECTED") return "ปฏิเสธ";
  return status || "-";
};

export default function OrderCustomerSearchInput({
  value,
  onChange,
  onSelectCustomer,
  onSelectOrder,
  onSubmit,
  placeholder = "สแกนบาร์โค้ด / INV-202X-XXX หรือ ชื่อลูกค้า...",
  orderSectionTitle = "รายการบิล / คำสั่งซื้อ (คลิกเพื่อค้นหาด้วยเลขที่บิลนี้)",
  customerSectionTitle = "ลูกค้า / อู่ (คลิกเพื่อค้นหาด้วยชื่อนี้)",
  fetchOrders,
  fetchCustomers,
  autoFocus = false,
  className,
  inputClassName,
  icon,
}: OrderCustomerSearchInputProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerDiscountResponse[]>([]);
  const [orderSuggestions, setOrderSuggestions] = useState<SuggestionOrder[]>([]);
  const [coords, setCoords] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
  const [dropUp, setDropUp] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // คำนวณตำแหน่ง dropdown เทียบกับ viewport สำหรับ Portal
  const updatePosition = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
    });

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedMenuHeight = 320;
    setDropUp(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow);
  };

  // ติดตามการเลื่อนหน้าจอหรือ resize เพื่อปรับตำแหน่งตาม trigger
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // ปิด Dropdown เมื่อคลิกนอกพื้นที่ Component (เช็คทั้ง trigger และ menu ที่ portal ออกไป)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideContainer = containerRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideContainer && !insideMenu) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced live search สำหรับลูกค้าและบิล
  useEffect(() => {
    const cleaned = value.trim();
    if (!cleaned) {
      setCustomerSuggestions([]);
      setOrderSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const customerPromise = fetchCustomers
          ? fetchCustomers(cleaned)
          : posApiService.searchCustomerDiscount(cleaned);
        const orderPromise = fetchOrders ? fetchOrders(cleaned) : Promise.resolve([]);

        const [custRes, orderRes] = await Promise.all([customerPromise, orderPromise]);

        if (isCurrent) {
          const matchedCustomers = (custRes || []).slice(0, 5);
          const matchedOrders = (orderRes || []).slice(0, 6);

          setCustomerSuggestions(matchedCustomers);
          setOrderSuggestions(matchedOrders);

          if (matchedCustomers.length > 0 || matchedOrders.length > 0) {
            updatePosition();
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch search suggestions:", err);
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [value, fetchOrders, fetchCustomers]);

  const handleCustomerClick = (cust: CustomerDiscountResponse) => {
    onChange(cust.customer_name);
    setIsOpen(false);
    if (onSelectCustomer) {
      onSelectCustomer(cust.customer_name, cust);
    } else if (onSubmit) {
      onSubmit();
    }
  };

  const handleOrderClick = (order: SuggestionOrder) => {
    onChange(order.order_number);
    setIsOpen(false);
    if (onSelectOrder) {
      onSelectOrder(order.order_number, order);
    } else if (onSubmit) {
      onSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setIsOpen(false);
      onSubmit?.();
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleFocus = () => {
    if (value.trim().length > 0 && (customerSuggestions.length > 0 || orderSuggestions.length > 0)) {
      updatePosition();
      setIsOpen(true);
    }
  };

  const hasSuggestions = customerSuggestions.length > 0 || orderSuggestions.length > 0;

  return (
    <div ref={containerRef} className={cn("relative flex-1", className)}>
      {icon !== undefined ? (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none flex items-center justify-center">
          {icon}
        </div>
      ) : (
        <ScanBarcode
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none"
          size={18}
        />
      )}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        className={cn(
          "w-full bg-white border border-gray-200 rounded-none pl-11 pr-10 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm transition-all placeholder:text-[#6B7280]",
          inputClassName
        )}
      />

      {isLoading ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none">
          <Loader2 size={16} className="animate-spin text-gray-400" />
        </div>
      ) : value ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
            onSubmit?.();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer z-10"
          title="ล้างคำค้นหา"
        >
          <X size={16} />
        </button>
      ) : null}

      {/* Autocomplete Dropdown - ใช้ createPortal ไปยัง document.body ป้องกันโดน parent overflow ตัดขอบ และไม่ซ้อนหลังกล่อง input/select อื่น */}
      {isOpen && hasSuggestions && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            ...(dropUp
              ? { bottom: window.innerHeight - coords.top + 4 }
              : { top: coords.bottom + 4 }),
            left: coords.left,
            width: coords.width,
            maxHeight: 320,
          }}
          className="z-50 bg-white border border-gray-200 shadow-2xl overflow-y-auto divide-y divide-gray-100"
        >
          {/* หมวดที่ 1: รายชื่อลูกค้า / อู่ */}
          {customerSuggestions.length > 0 && (
            <div>
              <div className="bg-[#F6F3F2] px-3.5 py-1.5 text-[11px] text-[#6B7280] flex items-center justify-between uppercase tracking-wider font-normal">
                <span className="flex items-center gap-1.5">
                  <User size={12} className="text-gray-500" />
                  {customerSectionTitle}
                </span>
                <span className="text-[10px] text-gray-400 font-light">
                  {customerSuggestions.length} รายชื่อ
                </span>
              </div>
              {customerSuggestions.map((cust) => (
                <div
                  key={`cust-${cust.id}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCustomerClick(cust);
                  }}
                  className="p-3 hover:bg-slate-50 flex justify-between items-center cursor-pointer transition-colors text-left"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Text variant="small" className="text-[#1C1B1B] font-normal mb-0 leading-tight">
                        {cust.customer_name}
                      </Text>
                      {cust.customer_type && (
                        <Badge
                          variant={getCustomerTypeVariant(cust.customer_type.type_name)}
                          size="auto"
                          className="font-normal"
                        >
                          {cust.customer_type.type_label || cust.customer_type.type_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {cust.phone_number && (
                        <Text variant="xs" className="text-[11px] text-[#6B7280] mb-0 font-light">
                          โทร: {cust.phone_number}
                        </Text>
                      )}
                      {cust.id_card_number_customer && (
                        <Text variant="xs" className="text-[11px] text-[#6B7280] mb-0 font-light">
                          {cust.phone_number ? "• " : ""}เลขบัตร: {cust.id_card_number_customer}
                        </Text>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col shrink-0 pl-4">
                    <span className="text-xs text-[#E51C23] font-normal">
                      เลือกชื่อนี้ ↵
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* หมวดที่ 2: รายการบิล / คำสั่งซื้อ */}
          {orderSuggestions.length > 0 && (
            <div>
              <div className="bg-[#F6F3F2] px-3.5 py-1.5 text-[11px] text-[#6B7280] flex items-center justify-between uppercase tracking-wider font-normal">
                <span className="flex items-center gap-1.5">
                  <FileText size={12} className="text-gray-500" />
                  {orderSectionTitle}
                </span>
                <span className="text-[10px] text-gray-400 font-light">
                  {orderSuggestions.length} รายการ
                </span>
              </div>
              {orderSuggestions.map((order) => (
                <div
                  key={`order-${order.id}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleOrderClick(order);
                  }}
                  className="p-3 hover:bg-slate-50 flex justify-between items-center cursor-pointer transition-colors text-left"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Text variant="small" className="text-[#1C1B1B] font-normal mb-0 leading-tight">
                        {order.order_number}
                      </Text>
                      {order.status && (
                        <Badge
                          variant={getOrderStatusVariant(order.status)}
                          size="auto"
                          className="font-normal"
                        >
                          {getOrderStatusLabel(order.status)}
                        </Badge>
                      )}
                    </div>
                    <Text variant="xs" className="text-[11px] text-[#6B7280] mb-0 mt-1 font-light">
                      ลูกค้า: {order.customer_name || "ลูกค้าทั่วไป"}
                    </Text>
                  </div>
                  <div className="text-right flex flex-col shrink-0 pl-4">
                    {order.total_amount !== undefined && (
                      <Text variant="xs" className="text-[#1C1B1B] font-normal mb-0">
                        ฿{order.total_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </Text>
                    )}
                    <span className="text-[10px] text-gray-400 font-light">
                      {order.order_date ? new Date(order.order_date).toLocaleDateString("th-TH") : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
