import Badge from "../components/elements/badge";

// Helper สำหรับ Badge ประเภทลูกค้า
export const getCustomerTypeBadge = (typeName?: string, typeLabel?: string) => {
  const name = typeName?.toUpperCase() || "";
  if (name === "GARAGE" || typeLabel?.includes("อู่")) {
    return (
      <Badge variant="warning" className="rounded-none font-normal text-[11px]">
        {typeLabel || "ลูกค้าอู่"}
      </Badge>
    );
  }
  if (name === "WHOLESALE" || typeLabel?.includes("บริษัท")) {
    return (
      <Badge variant="neutral" className="rounded-none font-normal text-[11px] bg-slate-700 text-white">
        {typeLabel || "ลูกค้าบริษัท"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-none font-normal text-[11px]">
      {typeLabel || "ลูกค้าทั่วไป"}
    </Badge>
  );
};