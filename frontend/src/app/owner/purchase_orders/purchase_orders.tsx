import React, { useState } from "react";
import {
  ShoppingBasket, CircleCheck, Pencil,
  Eye, Printer, Trash2,
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";

import Heading from "../../../components/elements/heading";
import Input   from "../../../components/elements/input";
import Select  from "../../../components/elements/select";
import Button  from "../../../components/elements/button";
import { Badge } from "../../../components/elements/badge";
import {
  Card, CardHeader, CardTitle, CardContent,
} from "../../../components/elements/card";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "../../../components/elements/table";

import { cn } from "../../../utils/component";

// ─── Mock Data ──────────
const mockPurchaseOrders = [
  {
    id: "PO-2026-00127", createdAt: "27/03/2569",
    supplier: "AutoParts Global Co.", supplierCode: "VND-8821",
    creator: "เขมจิรา", totalItems: 12, totalQty: 450,
    totalPrice: "12,500.00", status: "pending",
  },
  {
    id: "PO-2026-00126", createdAt: "25/03/2569",
    supplier: "Precision Logistics", supplierCode: "VND-9901",
    creator: "พนิดา", totalItems: 5, totalQty: 120,
    totalPrice: "10,500.00", status: "approved",
  },
  {
    id: "PO-2026-00125", createdAt: "12/03/2569",
    supplier: "Engine Solutions", supplierCode: "VND-4452",
    creator: "พนิดา", totalItems: 22, totalQty: 1050,
    totalPrice: "30,090.00", status: "approved",
  },
  {
    id: "PO-2026-00124", createdAt: "28/02/2569",
    supplier: "Thai Pistons Corp", supplierCode: "VND-1102",
    creator: "เขมจิรา", totalItems: 2, totalQty: 50,
    totalPrice: "1,200.00", status: "rejected",
  },
];

// ─── Status Badge Helper ───────────

function StatusBadge({ status }: { status: string }) {
  if (status === "pending")
    return <Badge variant="outline" className="text-gray-800 border-gray-400">รออนุมัติ</Badge>;
  if (status === "approved")
    return <Badge variant="success" dot>อนุมัติแล้ว</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive">ไม่อนุมัติ</Badge>;
  return null;
}

// ─── Action Buttons Helper ────

function ActionButtons({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <div className="flex items-center justify-center gap-3">
        <button className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded transition cursor-pointer">
          <CircleCheck className="w-4 h-4" />
        </button>
        <button className="text-gray-600 hover:text-gray-800 transition cursor-pointer">
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <button className="text-gray-500 hover:text-gray-700 transition cursor-pointer">
        <Eye className="w-4 h-4" />
      </button>
      {status === "approved" ? (
        <button className="text-gray-500 hover:text-gray-700 transition cursor-pointer">
          <Printer className="w-4 h-4" />
        </button>
      ) : (
        <button className="text-gray-400 hover:text-red-600 transition cursor-pointer">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Page ──────────
const PurchaseOrders: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchId,     setSearchId]     = useState("");
  const [dateFilter,   setDateFilter]   = useState("");

  // ─── Filter Logic ───────────────────────────────────────────────────────────
  const filteredOrders = mockPurchaseOrders.filter((po) => {
    const matchId     = po.id.toLowerCase().includes(searchId.toLowerCase());
    const matchStatus = statusFilter === "all" || po.status === statusFilter;
    // dateFilter เทียบแบบ string เพราะ mockData เป็น "DD/MM/YYYY"
    const matchDate   = !dateFilter || po.createdAt === dateFilter;
    return matchId && matchStatus && matchDate;
  });

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen font-sans">

      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <Heading level="h2" weight="semibold" className="m-0 text-gray-800">
          จัดการใบสั่งซื้อ
        </Heading>
        <Button leftIcon={<ShoppingBasket className="h-5 w-5" />} size="md">
          สร้างใบสั่งซื้อใหม่
        </Button>
      </div>

      {/* 2. Search + Stats */}
      <div className="flex gap-6 items-stretch">

        {/* Search Card */}
        <Card className="flex-1 w-3/4">
          <CardHeader>
            <CardTitle className="text-base">ค้นหาใบสั่งซื้อด้วย</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 items-end">
              <Input
                label="หมายเลขใบสั่งซื้อ"
                placeholder="PO-2024-XXXX"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
              <Select
                label="สถานะใบสั่งซื้อ"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { label: "ทั้งหมด",     value: "all"      },
                  { label: "รออนุมัติ",   value: "pending"  },
                  { label: "อนุมัติแล้ว", value: "approved" },
                  { label: "ไม่อนุมัติ",  value: "rejected" },
                ]}
              />
              <Input type="date" label="วันที่สั่งซื้อ"/>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Stats Card */}
        <div className="bg-[#22252a] text-white rounded-xl p-6 w-1/4 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <p className="text-sm text-gray-400 font-light">ใบสั่งซื้อทั้งหมดของเดือนนี้</p>
            <p className="text-4xl font-bold mt-2 flex items-baseline gap-2">
              42 <span className="text-lg font-normal text-gray-300">ใบสั่งซื้อ</span>
            </p>
          </div>
          <p className="text-emerald-400 text-sm mt-4 flex items-center gap-1 font-light">
            <span className="text-base">↗</span> 12% เพิ่มขึ้นจากเดือนที่แล้ว
          </p>
          <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
            <ShoppingBasket className="w-24 h-24" />
          </div>
        </div>

      </div>

      {/* 3. Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="border-l-[5px] border-l-black flex flex-col justify-center h-24 p-5">
          <p className="text-sm text-gray-500 font-medium">รออนุมัติ</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">฿ 12,500.00</p>
        </Card>
        <Card className="border-l-[5px] border-l-emerald-500 flex flex-col justify-center h-24 p-5">
          <p className="text-sm text-gray-500 font-medium">อนุมัติแล้ว (MTD)</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">฿ 40,590.00</p>
        </Card>
        <Card className="border-l-[5px] border-l-red-500 flex flex-col justify-center h-24 p-5">
          <p className="text-sm text-gray-500 font-medium">ไม่อนุมัติ (MTD)</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">฿ 1,200.00</p>
        </Card>
      </div>

      {/* 4. Table */}
      <Card className="overflow-hidden" noPadding>
        <Table>
          <TableHeader className="bg-gray-100 text-gray-600">
            <TableRow>
              <TableHead className="pl-6">เลขที่ใบสั่งซื้อ</TableHead>
              <TableHead>วันที่สร้าง</TableHead>
              <TableHead>ผู้จัดจำหน่าย</TableHead>
              <TableHead>พนักงานผู้สร้าง</TableHead>
              <TableHead className="text-center">รวมรายการ</TableHead>
              <TableHead className="text-center">จำนวนชิ้น</TableHead>
              <TableHead className="text-right pr-6">ราคารวม</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="text-gray-700">
            {mockPurchaseOrders.map((po) => (
              <TableRow key={po.id} className="hover:bg-gray-50/70">
                <TableCell className="pl-6 font-semibold text-gray-900">
                  {po.id}
                </TableCell>
                <TableCell className="text-gray-500">{po.createdAt}</TableCell>
                <TableCell>
                  <div className="font-medium text-gray-900">{po.supplier}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{po.supplierCode}</div>
                </TableCell>
                <TableCell className="text-gray-600">{po.creator}</TableCell>
                <TableCell className="text-center font-medium">{po.totalItems}</TableCell>
                <TableCell className="text-center font-medium">{po.totalQty}</TableCell>
                <TableCell className="text-right pr-6 font-medium text-gray-900">
                  ฿{po.totalPrice}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={po.status} />
                </TableCell>
                <TableCell className="text-center">
                  <ActionButtons status={po.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* 5. Pagination */}
        <div className="bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>แสดง 4 จาก 124 ใบสั่งซื้อ</span>

          <div className="flex items-center gap-1">
            <button
              disabled
              aria-label="หน้าแรก"
              className="p-1.5 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              disabled
              aria-label="หน้าก่อนหน้า"
              className="p-1.5 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {[1, 2, 3].map((page) => (
              <button
                key={page}
                aria-label={`หน้า ${page}`}
                aria-current={page === 1 ? "page" : undefined}
                className={cn(
                  "px-3 py-1.5 rounded font-medium transition-colors",
                  page === 1
                    ? "bg-[#d61c24] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {page}
              </button>
            ))}

            <button aria-label="หน้าถัดไป" className="p-1.5 rounded text-gray-500 hover:bg-gray-100">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button aria-label="หน้าสุดท้าย" className="p-1.5 rounded text-gray-500 hover:bg-gray-100">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

    </div>
  );
};

export default PurchaseOrders;