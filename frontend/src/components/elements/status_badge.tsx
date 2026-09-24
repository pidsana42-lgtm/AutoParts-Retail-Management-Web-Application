import React from "react";
import Badge from "./badge";
import { cn } from "../../utils/component";
import { getPaymentVariant } from "../../utils/poshelpers";

// ==========================================
// 1. Customer Type Badge
// ==========================================
export interface CustomerTypeBadgeProps {
  typeName?: string | null;
  typeLabel?: string | null;
  className?: string;
}

export const CustomerTypeBadge: React.FC<CustomerTypeBadgeProps> = ({
  typeName,
  typeLabel,
  className,
}) => {
  const name = typeName?.toUpperCase() || "";
  if (name === "GARAGE" || typeLabel?.includes("อู่")) {
    return (
      <Badge variant="garage" className={cn("rounded-none font-normal text-[11px]", className)}>
        {typeLabel || "ลูกค้าอู่"}
      </Badge>
    );
  }
  if (name === "WHOLESALE" || typeLabel?.includes("บริษัท")) {
    return (
      <Badge variant="wholesale" className={cn("rounded-none font-normal text-[11px]", className)}>
        {typeLabel || "ลูกค้าบริษัท"}
      </Badge>
    );
  }
  return (
    <Badge variant="customer" className={cn("rounded-none font-normal text-[11px]", className)}>
      {typeLabel || "ลูกค้าทั่วไป"}
    </Badge>
  );
};

// ==========================================
// 2. Sales / POS Status Badge
// ==========================================
export interface SalesStatusBadgeProps {
  status?: string | null;
  paymentStatus?: string | null;
  className?: string;
}

export const SalesStatusBadge: React.FC<SalesStatusBadgeProps> = ({
  status = "",
  paymentStatus = "",
  className,
}) => {
  const billStatus = (status || "").trim().toUpperCase();
  const payStatus = (paymentStatus || "").trim().toUpperCase();

  // 1. เช็กการยกเลิกก่อน
  if (billStatus === "PENDING_CANCEL") {
    return (
      <Badge variant="warning" className={cn("rounded-none whitespace-nowrap", className)}>
        ส่งคำขอยกเลิกแล้ว
      </Badge>
    );
  }

  if (billStatus === "CANCELLED" || billStatus === "ยกเลิก") {
    return (
      <Badge variant="error" className={cn("rounded-none whitespace-nowrap", className)}>
        ยกเลิกแล้ว
      </Badge>
    );
  }

  // 2. เช็กสถานะการคืนสินค้า (Return) - ต้องเช็กก่อนสถานะการชำระเงิน เพราะบิลที่คืนเงินมักมีสถานะ PAID มาก่อน
  if (billStatus === "PENDING_RETURN" || billStatus === "รออนุมัติคืน" || billStatus === "รอคืนสินค้า") {
    return (
      <Badge variant="warning" className={cn("rounded-none whitespace-nowrap bg-amber-100 text-amber-800 font-normal", className)}>
        รออนุมัติคืน
      </Badge>
    );
  }

  if (billStatus === "RETURNED" || billStatus === "REFUNDED" || billStatus === "คืนสินค้าแล้ว") {
    return (
      <Badge variant="error" className={cn("rounded-none whitespace-nowrap bg-amber-100 text-amber-800  font-normal", className)}>
        คืนสินค้าแล้ว
      </Badge>
    );
  }

  if (billStatus === "PARTIAL_RETURNED" || billStatus === "คืนบางส่วน") {
    return (
      <Badge variant="warning" className={cn("rounded-none whitespace-nowrap bg-orange-100 text-orange-800 font-normal", className)}>
        คืนบางส่วน
      </Badge>
    );
  }

  // 3. เช็กสถานะการเคลมสินค้า (Claim)
  if (billStatus === "CLAIMED" || billStatus === "เคลมสินค้าแล้ว") {
    return (
      <Badge variant="info" className={cn("rounded-none whitespace-nowrap bg-purple-100 text-purple-800 font-normal", className)}>
        เคลมสินค้าแล้ว
      </Badge>
    );
  }

  if (billStatus === "CLAIM_IN_PROGRESS" || billStatus === "PENDING_CLAIM" || billStatus === "อยู่ระหว่างเคลม" || billStatus === "รอเคลม") {
    return (
      <Badge variant="warning" className={cn("rounded-none whitespace-nowrap bg-indigo-100 text-indigo-800 border border-indigo-300 font-medium", className)}>
        อยู่ระหว่างเคลม
      </Badge>
    );
  }

  // 4. ถ้าชำระเงินครบถ้วนแล้ว (paid) -> แสดง "ชำระแล้ว"
  if (payStatus === "PAID" || payStatus === "ชำระแล้ว") {
    return (
      <Badge variant="success" className={cn("rounded-none whitespace-nowrap", className)}>
        ชำระแล้ว
      </Badge>
    );
  }

  // 5. ถ้าเป็นบิลเงินเชื่อที่ทำรายการเสร็จแล้ว แต่ยังไม่ชำระ (completed + unpaid/partial)
  if (billStatus === "COMPLETED") {
    return (
      <Badge variant="info" className={cn("rounded-none whitespace-nowrap", className)}>
        ทำรายการแล้ว
      </Badge>
    );
  }

  // 6. สถานะรอดำเนินการ / รอตอบรับ
  if (billStatus === "PENDING") {
    return (
      <Badge variant="neutral" className={cn("rounded-none whitespace-nowrap", className)}>
        รอดำเนินการ
      </Badge>
    );
  }

  if (billStatus === "OVERDUE" || payStatus === "OVERDUE") {
    return (
      <Badge variant="error" className={cn("rounded-none whitespace-nowrap", className)}>
        เกินกำหนด
      </Badge>
    );
  }

  // default สำรองกรณีค่าอื่น
  return (
    <Badge variant="info" className={cn("rounded-none whitespace-nowrap", className)}>
      {status || "ไม่ทราบสถานะ"}
    </Badge>
  );
};

export const PosStatusBadge = SalesStatusBadge;

// ==========================================
// 3. Sales Cancellation Status Badge
// ==========================================
export interface SalesCancellationStatusBadgeProps {
  status?: string | null;
  paymentStatus?: string | null;
  cancelRemark?: string | null;
  cancelProcessedAt?: any;
  className?: string;
}

export const SalesCancellationStatusBadge: React.FC<SalesCancellationStatusBadgeProps> = ({
  status = "",
  className,
}) => {
  const billStatus = (status || "").trim().toUpperCase();

  if (billStatus === "PENDING_CANCEL") {
    return (
      <Badge variant="warning" className={cn("rounded-none whitespace-nowrap", className)}>
        รอดำเนินการ
      </Badge>
    );
  }

  if (billStatus === "CANCELLED" || billStatus === "ยกเลิก") {
    return (
      <Badge variant="success" className={cn("rounded-none whitespace-nowrap", className)}>
        อนุมัติแล้ว
      </Badge>
    );
  }

  // หากเป็น COMPLETED หรือสถานะอื่นๆ ในหน้าคำขอยกเลิก แสดง "ไม่อนุมัติ"
  return (
    <Badge variant="error" className={cn("rounded-none whitespace-nowrap", className)}>
      ไม่อนุมัติ
    </Badge>
  );
};

export const CancellationStatusBadge = SalesCancellationStatusBadge;

// ==========================================
// 4. Payment Transaction Type Badge
// ==========================================
export interface PaymentTypeBadgeProps {
  type?: string | null;
  className?: string;
}

export const PaymentTypeBadge: React.FC<PaymentTypeBadgeProps> = ({
  type = "",
  className,
}) => {
  const t = (type || "").toLowerCase();
  if (t === "refund" || t.includes("refund") || t.includes("คืน")) {
    return (
      <Badge variant="warning" className={cn("bg-amber-100 text-amber-800 font-normal", className)}>
        คืนเงิน
      </Badge>
    );
  }
  const isPayment = t === "payment";
  return (
    <Badge variant={isPayment ? "payment" : "repayment"} className={className}>
      {isPayment ? "ชำระสดหน้าร้าน" : "เคลียร์หนี้เงินเชื่อ"}
    </Badge>
  );
};

// ==========================================
// 5. Payment Status Badge
// ==========================================
export interface PaymentStatusBadgeProps {
  status?: string | null;
  cancelRemark?: string | null;
  className?: string;
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status = "",
  cancelRemark = "",
  className,
}) => {
  const s = (status || "").toLowerCase();
  if (s === "pending_cancel") {
    return <Badge variant="warning" className={className}>รออนุมัติยกเลิก</Badge>;
  }
  if (s === "cancelled") {
    return <Badge variant="error" className={className}>ยกเลิกแล้ว</Badge>;
  }
  if (s === "pending_return" || s === "รออนุมัติคืน" || s === "รอคืนสินค้า") {
    return <Badge variant="warning" className={cn("bg-amber-100 text-amber-800 font-normal", className)}>รออนุมัติคืน</Badge>;
  }
  if (s === "refunded" || s === "refund" || s === "returned" || s === "คืนเงินแล้ว" || s === "คืนสินค้าแล้ว") {
    return <Badge variant="warning" className={cn("bg-amber-100 text-amber-800 font-normal", className)}>คืนเงินแล้ว</Badge>;
  }
  if (s === "partial_returned" || s === "คืนบางส่วน") {
    return <Badge variant="warning" className={cn("bg-orange-100 text-orange-800 font-normal", className)}>คืนบางส่วน</Badge>;
  }
  if (s === "claim_in_progress" || s === "pending_claim" || s === "อยู่ระหว่างเคลม" || s === "รอเคลม") {
    return <Badge variant="warning" className={cn("bg-indigo-100 text-indigo-800 font-normal", className)}>อยู่ระหว่างเคลม</Badge>;
  }
  if (s === "claimed" || s === "เคลมสินค้าแล้ว" || s === "เคลมแล้ว") {
    return <Badge variant="info" className={cn("bg-purple-100 text-purple-800 font-normal", className)}>เคลมแล้ว</Badge>;
  }
  if (s === "rejected" || (s === "completed" && Boolean(cancelRemark && cancelRemark.trim() !== ""))) {
    return <Badge variant="neutral" className={className}>ไม่อนุมัติยกเลิก</Badge>;
  }
  return <Badge variant="success" className={className}>สำเร็จ</Badge>;
};

// ==========================================
// 6. Payment Method Badge
// ==========================================
export interface PaymentMethodBadgeProps {
  methodName?: string | null;
  className?: string;
}

export const PaymentMethodBadge: React.FC<PaymentMethodBadgeProps> = ({
  methodName = "",
  className,
}) => {
  return (
    <Badge variant={getPaymentVariant(methodName || "")} className={className}>
      {methodName || "-"}
    </Badge>
  );
};

// ==========================================
// Backwards Compatibility Render Functions
// ==========================================
export const getCustomerTypeBadge = (typeName?: string, typeLabel?: string) => (
  <CustomerTypeBadge typeName={typeName} typeLabel={typeLabel} />
);

export const renderStatusBadge = (status: string, paymentStatus: string) => (
  <SalesStatusBadge status={status} paymentStatus={paymentStatus} />
);

export const renderCancellationStatusBadge = (
  status?: string | null,
  paymentStatus?: string | null,
  cancelRemark?: string | null,
  cancelProcessedAt?: any
) => (
  <SalesCancellationStatusBadge
    status={status}
    paymentStatus={paymentStatus}
    cancelRemark={cancelRemark}
    cancelProcessedAt={cancelProcessedAt}
  />
);

export const renderPaymentTypeBadge = (type: string) => (
  <PaymentTypeBadge type={type} />
);

export const renderPaymentStatusBadge = (status?: string | null, cancelRemark?: string | null) => (
  <PaymentStatusBadge status={status} cancelRemark={cancelRemark} />
);
