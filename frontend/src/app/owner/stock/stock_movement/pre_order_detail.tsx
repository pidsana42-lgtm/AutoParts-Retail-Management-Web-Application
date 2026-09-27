import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Package, SquarePen } from "lucide-react";

import Breadcrumb from "../../../../components/elements/breadcrumb";
import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import Button from "../../../../components/elements/button";
import { Card } from "../../../../components/elements/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/elements/table";
import { getPreOrderById } from "../../../../service/http/pre-order/pre-order";
import type { PreOrder } from "../../../../interface/pre-order/pre-order";
import { usePathBasePrefix } from "../../../../utils/usePathBasePrefix";

// ป้ายช่องทางการจอง — ใช้ป้ายเดียวกับตัวเลือกในฟอร์มสร้าง/แก้ไขใบสั่งจอง (owner/pre-order/pre-order.tsx)
const CHANNEL_LABEL: Record<string, string> = {
  WALK_IN: "หน้าร้าน",
  TEL: "โทรศัพท์",
};

// StockMovementPreOrderDetail: หน้ารายละเอียดใบสั่งจองสินค้าล่วงหน้า (อ่านอย่างเดียว) ที่กดเข้ามาจากฟีด
// "การเคลื่อนไหวของคลังสินค้า" — ระบบเดิมมีแค่หน้าสร้าง/แก้ไข ไม่มีหน้าดูอย่างเดียวแยกต่างหาก จึงสร้างหน้านี้ขึ้นใหม่
// ปุ่ม "แก้ไขใบสั่งจอง" พาไปหน้าแก้ไขจริงที่ /owner/pre-orders?edit=<id> (หน้านั้นรองรับ deep-link ผ่าน query นี้อยู่แล้ว)
export default function StockMovementPreOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();
  const [order, setOrder] = useState<PreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError("");
        const data = await getPreOrderById(Number(id));
        if (alive) setOrder(data);
      } catch (err) {
        console.error("Failed to load pre-order:", err);
        if (alive) setError("ไม่พบข้อมูลใบสั่งจองสินค้านี้ หรือไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const items = order?.pre_order_items || [];
  const totalQty = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const orderDateText = order?.order_date
    ? new Date(order.order_date).toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" })
    : "-";

  return (
    <div className="space-y-6 p-6 font-sans bg-gray-50 min-h-screen">
      <Breadcrumb
        items={[
          { label: "การเคลื่อนไหวของคลังสินค้า", path: `${basePath}/stock/stock-movement` },
          { label: "ดูรายละเอียดใบสั่งจองสินค้า" },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading level="h1" className="mb-1 font-bold text-[#1C1B1B]">
            รายละเอียดใบสั่งจองสินค้าล่วงหน้า
          </Heading>
          {order?.id && (
            <Text variant="muted" className="mb-0">
              เลขที่ใบสั่งจอง: PRE-{String(order.id).padStart(4, "0")}
            </Text>
          )}
        </div>
        {order && (
          <Button
            type="button"
            variant="solid-red"
            onClick={() => navigate(`${basePath}/pre-orders?edit=${order.id}`)}
            className="flex items-center gap-2"
          >
            <SquarePen size={14} />
            แก้ไขใบสั่งจอง
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[calc(100vh-16rem)] w-full flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
          <span className="text-sm font-medium text-slate-400">กำลังโหลดข้อมูลใบสั่งจอง...</span>
        </div>
      ) : error || !order ? (
        <div className="p-6 text-center font-medium text-red-600">{error || "ไม่พบข้อมูล"}</div>
      ) : (
        <>
          <Card title="ข้อมูลผู้สั่งจอง">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReadonlyField label="ช่องทางการจอง" value={CHANNEL_LABEL[order.pre_order_type] || order.pre_order_type || "-"} />
              <ReadonlyField label="ชื่อผู้สั่งจอง" value={order.customer_name || "-"} />
              <ReadonlyField label="เบอร์โทรศัพท์" value={order.customer_phone || "-"} />
              <ReadonlyField label="วันที่สั่งจอง" value={orderDateText} />
            </div>
          </Card>

          <Card title={`รายการสินค้าสั่งจอง (${items.length} รายการ)`} noPadding>
            <Table>
              <TableHeader className="bg-[#f6f3f2] text-[#797878]">
                <TableRow>
                  <TableHead className="pl-6 w-16">ลำดับ</TableHead>
                  <TableHead className="w-20">รูปภาพ</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>รหัสสินค้า</TableHead>
                  <TableHead className="text-right pr-6">จำนวน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-gray-700">
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-slate-400">
                      ไม่มีรายการสินค้าในใบสั่งจองนี้
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => (
                    <TableRow key={item.id ?? idx}>
                      <TableCell className="pl-6 text-gray-500">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-gray-100 text-gray-300">
                          <Package size={18} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-[#1C1B1B]">{item.product_name || "-"}</div>
                        {!!item.product_id && (
                          <span className="mt-1 inline-block border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            จากสต็อก
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">{item.product_code || "-"}</TableCell>
                      <TableCell className="text-right pr-6 font-medium text-[#1C1B1B]">{item.quantity}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-0.5 text-sm text-slate-600">
              <p className="m-0">
                จำนวนรายการทั้งหมด: <span className="font-bold text-[#1C1B1B]">{items.length} รายการ</span>
              </p>
              <p className="m-0">
                จำนวนชิ้นรวม: <span className="font-bold text-[#1C1B1B]">{totalQty} ชิ้น</span>
              </p>
            </div>
            <Button type="button" variant="outline-cancel" onClick={() => navigate(`${basePath}/stock/stock-movement`)}>
              ปิด
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-[#1C1B1B]">{label}</label>
      <div className="h-10 w-full rounded-none border-none bg-[#f6f3f2] px-3 py-2 text-sm text-slate-700 flex items-center truncate">
        {value}
      </div>
    </div>
  );
}
