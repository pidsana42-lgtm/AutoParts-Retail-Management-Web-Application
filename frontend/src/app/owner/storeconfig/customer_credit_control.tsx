import React, { useState } from "react";
import {
  Users,
  CreditCard,
  Percent,
  ShieldAlert,
  History,
  RefreshCw,
  ScanBarcode,
  Search,
  Edit,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  BadgePercent,
  ShieldCheck,
  Building2,
  Wrench,
  User,
} from "lucide-react";
 
// Design System Components
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Input from "../../../components/elements/input";
import Select from "../../../components/elements/select";
import Button from "../../../components/elements/button";
import Modal from "../../../components/elements/modal";
import { Card, CardContent } from "../../../components/elements/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../../components/elements/table";

// Helpers & Components
import { CustomerTypeBadge } from "../../../components/elements/status_badge";
import { CustomerCard } from "../../employee/pos/components/customercard";

// Hook & Interfaces
import { useCustomerCreditControl } from "./hook/UseCustomerCreditControl";
import type { CustomerCreditItem } from "../../../interface/storeconfig/customer_credit_interface";

export default function CustomerCreditControl() {
  const {
    // Data & Stats
    customers,
    filteredCustomers,
    paginatedCustomers,
    customerTypes,
    stats,

    // Loading & Status
    isLoading,
    isUpdating,
    error,
    successMessage,

    // Filter
    filter,
    handleSearchChange,
    handleCustomerTypeChange,
    handleCreditStatusChange,
    handleDiscountStatusChange,
    handleResetFilter,

    // Pagination
    page,
    setPage,
    limit,
    setLimit,
    totalRows,
    totalPages,

    // Modals & Selected
    selectedCustomer,
    drawerCustomer,
    setDrawerCustomer,
    isEditModalOpen,
    setIsEditModalOpen,
    isAuditModalOpen,
    setIsAuditModalOpen,
    auditLogs,

    // Actions
    handleOpenEditModal,
    handleUpdateDiscount,
    handleQuickToggleDiscount,
    refetch,
  } = useCustomerCreditControl();

  // Edit Modal Form Local State
  const [editFormData, setEditFormData] = useState<{
    customerId: number;
    is_discount_enabled: boolean;
    ontop_discount_rate: number;
    standard_discount_rate: number;
  }>({
    customerId: 0,
    is_discount_enabled: false,
    ontop_discount_rate: 0,
    standard_discount_rate: 0,
  });

  // When opening edit modal, initialize form state
  const onOpenEdit = (customer: CustomerCreditItem) => {
    setEditFormData({
      customerId: customer.id,
      is_discount_enabled: customer.is_discount_enabled,
      ontop_discount_rate: customer.ontop_discount_rate,
      standard_discount_rate: customer.standard_discount_rate,
    });
    handleOpenEditModal(customer);
  };

  // Submit Edit Modal Form
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleUpdateDiscount({
      customerId: editFormData.customerId,
      is_discount_enabled: editFormData.is_discount_enabled,
      ontop_discount_rate: editFormData.ontop_discount_rate,
      standard_discount_rate: editFormData.standard_discount_rate,
    });
  };

  return (
    <div className="relative flex min-h-screen bg-white text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
         <main className="p-6 md:p-8 space-y-6 flex-1 max-w-[1200px] mx-auto w-full">
          
          {/* ==================== Header Section ==================== */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4pb-5">
              <div>
                <Heading level='h1' weight='semibold' className='m-0 text-black'>
                  การควบคุมเครดิตและสิทธิ์ส่วนลดลูกค้า
                </Heading>
                <Heading level='h6' className='m-0 mt-1'>
                  กำหนดวงเงินเครดิต การระงับสิทธิ์ และอัตราส่วนลดพิเศษ (On-Top) สำหรับลูกค้าแต่ละราย
                </Heading>
              </div>
            

              {/* Top Action Buttons */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline-cancel"
                  leftIcon={<History size={16} />}
                  onClick={() => setIsAuditModalOpen(true)}
                  className="rounded-none h-11 px-4 text-xs font-normal text-[#5F5E5E] bg-white border border-gray-200 hover:bg-[#F6F3F2] shadow-none cursor-pointer transition-colors"
                >
                  ประวัติการแก้ไข
                </Button>
              </div>
            </div>


          {/* ==================== Feedback Alerts ====================
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between rounded-none animate-fade-in shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span className="font-medium">{successMessage}</span>
              </div>
              <Badge variant="success" className="rounded-none font-normal text-xs">
                บันทึกสำเร็จ
              </Badge>
            </div>
          )} */}

          {/* {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between rounded-none animate-fade-in shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={18} className="text-red-600 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
              <Badge variant="destructive" className="rounded-none font-normal text-xs">
                ข้อผิดพลาด
              </Badge>
            </div>
          )} */}

          {/* ==================== Summary Stats Cards ==================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: ลูกค้าทั้งหมด */}
            <Card className="border-l-5 !border-l-slate-300 flex flex-col justify-between p-4 md:p-5">
                <div className="flex items-start justify-between">
                <div>
                 <Heading level="h6" className="uppercase tracking-wider">
                    ลูกค้าทั้งหมดในระบบ
                  </Heading>
                   <Heading level="h3">
                    {stats.totalCustomers} <span className="text-sm font-normal text-[#1C1B1B]">ราย</span>
                  </Heading>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">                
                <span>อู่: <strong className="font-normal text-[#1C1B1B]">{stats.garageCustomers}</strong></span>
                <span>บริษัท: <strong className="font-normal text-[#1C1B1B]">{stats.wholesaleCustomers}</strong></span>
                <span>ทั่วไป: <strong className="font-normal text-[#1C1B1B]">{stats.generalCustomers}</strong></span>
              </div>
            </Card>

            {/* Card 2: หนี้เครดิตคงค้างรวม */}
            <Card className="border-l-5 !border-l-[#E51C23] flex flex-col justify-between p-4 md:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Heading level="h6" className="uppercase tracking-wider">
                    ยอดหนี้เครดิตคงค้างรวม
                  </Heading>
                  <Heading level="h3">
                    ฿{stats.totalOutstandingDebt.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Heading>
                </div>
              </div>
             <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
              <span>วงเงินเครดิตรวม:</span>
              <span className="text-[#1C1B1B] font-normal">฿{stats.totalCreditLimit.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </Card>

            {/* Card 3: สิทธิ์ส่วนลดพิเศษ */}
            <Card className="!border-l-[5px] !border-l-emerald-500 flex flex-col justify-between p-4 md:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Heading level="h6" className="uppercase tracking-wider">
                    สิทธิ์ราคาพิเศษ (เปิดใช้งาน)
                  </Heading>
                  <Heading level="h3">
                    {stats.discountEnabledCount}  <span className="text-sm font-normal text-[#1C1B1B]">ราย</span>
                  </Heading>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-gray-100 text-xs text-emerald-700 font-light">
                ได้รับสิทธิ์ส่วนลด On-Top อัตโนมัติในระบบ
              </div>
            </Card>

            {/* Card 4: เฝ้าระวังวงเงินเครดิต */}
            <Card className="border-l-5 !border-l-amber-300 flex flex-col justify-between p-4 md:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Heading level="h6" className="uppercase tracking-wider">
                    เฝ้าระวังวงเงินเครดิต (≥ 80%)
                  </Heading>
                  <Heading level="h3">
                    {stats.nearOrOverLimitCount} <span className="text-sm font-normal text-[#1C1B1B]">ราย</span>
                  </Heading>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-gray-100 text-xs text-amber-500 font-light">
                ยอดหนี้ใกล้เต็มหรือเกินเพดานที่กำหนด
              </div>
            </Card>
          </div>

          {/* ==================== Search & Filter Bar ==================== */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
            <CardContent className="p-5 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                {/* Search query (col-span-4) */}
                <div className="lg:col-span-4 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E] font-normal">
                    ค้นหาชื่อลูกค้า / หมายเลขโทรศัพท์ / บัตรประชาชน
                  </Text>
                  <div className="relative flex-1">
                    <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                    <Input
                      value={filter.search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="พิมพ์ชื่อลูกค้า / เบอร์โทร / เลขบัตร..."
                      className="w-full h-11 bg-white border border-gray-200 rounded-none pl-12 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-[#E51C23] focus:ring-1 focus:ring-[#E51C23] shadow-xs placeholder:text-[#6B7280]"
                    />
                  </div>
                </div>

                {/* Filter by Customer Type (col-span-3) */}
                <div className="lg:col-span-3 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E] font-normal">
                    ประเภทลูกค้า
                  </Text>
                  <Select
                    value={filter.customer_type_id}
                    onChange={(e) => handleCustomerTypeChange(e.target.value)}
                    placeholder="ประเภทลูกค้าทั้งหมด"
                    className="bg-white border border-gray-200 rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-xs cursor-pointer"
                    options={[
                      { label: "ประเภทลูกค้าทั้งหมด", value: "" },
                      ...customerTypes.map((t) => ({
                        label: t.type_label || t.type_name,
                        value: String(t.id),
                      })),
                    ]}
                  />
                </div>

                {/* Filter by Credit Status (col-span-2) */}
                <div className="lg:col-span-2 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E] font-normal">
                    สถานะเครดิต / หนี้
                  </Text>
                  <Select
                    value={filter.credit_status}
                    onChange={(e) => handleCreditStatusChange(e.target.value as any)}
                    placeholder="สถานะเครดิตทั้งหมด"
                    className="bg-white border border-gray-200 rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-xs cursor-pointer"
                    options={[
                      { label: "ทั้งหมด", value: "ALL" },
                      { label: "มียอดหนี้ค้างชำระ", value: "WITH_DEBT" },
                      { label: "ใกล้เต็มวงเงิน (≥80%)", value: "NEAR_LIMIT" },
                      { label: "เกินวงเงินเครดิต", value: "OVER_LIMIT" },
                      { label: "ไม่มีหนี้ค้าง", value: "NO_DEBT" },
                    ]}
                  />
                </div>

                {/* Filter by Discount Status (col-span-2) */}
                <div className="lg:col-span-2 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E] font-normal">
                    สิทธิ์ราคาพิเศษ
                  </Text>
                  <Select
                    value={filter.discount_status}
                    onChange={(e) => handleDiscountStatusChange(e.target.value as any)}
                    placeholder="สิทธิ์ทั้งหมด"
                    className="bg-white border border-gray-200 rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-xs cursor-pointer"
                    options={[
                      { label: "สิทธิ์ทั้งหมด", value: "ALL" },
                      { label: "เปิดใช้งานส่วนลด", value: "ENABLED" },
                      { label: "ปิดใช้งานส่วนลด", value: "DISABLED" },
                    ]}
                  />
                </div>

                {/* Reset Filter Button (col-span-1) */}
                <div className="lg:col-span-1">
                  <Button
                    type="button"
                    variant="outline-cancel"
                    onClick={handleResetFilter}
                    className="w-full h-11 border border-gray-200 rounded-none text-xs text-[#5F5E5E] hover:bg-white transition-colors cursor-pointer"
                    title="ล้างตัวกรอง"
                  >
                    รีเซ็ต
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ==================== Customer Credit Table ==================== */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <Table className="!w-full !min-w-0 table-fixed text-left border-collapse">
              <TableHeader className="bg-[#F6F3F2] border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-4 w-[24%]">ชื่อลูกค้า / ติดต่อ</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[12%]">ประเภทลูกค้า</TableHead>
                  <TableHead className="py-3 px-4 w-[24%]">ยอดหนี้ / วงเงินเครดิต</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[14%]">ส่วนลด On-Top (%)</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[14%]">สิทธิ์ส่วนลดพิเศษ</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[12%]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-[#E51C23]" />
                        <Text variant="small" className="text-gray-500 mb-0 font-light">
                          กำลังโหลดข้อมูลสิทธิ์และเครดิตลูกค้า...
                        </Text>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Users size={32} className="stroke-[1.5] text-slate-300" />
                        <Text variant="small" className="text-gray-400 mb-0 font-light">
                          {customers.length === 0
                            ? "ยังไม่มีข้อมูลลูกค้าในระบบ"
                            : "ไม่พบข้อมูลลูกค้าที่ตรงกับเงื่อนไขการค้นหา"}
                        </Text>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCustomers.map((c) => {
                    const usagePercent =
                      c.max_credit_limit > 0
                        ? Math.min(100, Math.max(0, (c.current_debt_amount / c.max_credit_limit) * 100))
                        : 0;

                    const isNearOrOver =
                      c.max_credit_limit > 0 && c.current_debt_amount >= c.max_credit_limit * 0.8;
                    const isOverLimit =
                      c.max_credit_limit > 0 && c.current_debt_amount > c.max_credit_limit;

                    return (
                      <TableRow key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Name & Contact */}
                        <TableCell className="py-3.5 px-4 truncate">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">
                            {c.customer_name}
                          </Text>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#5F5E5E] font-light">
                            <span>โทร: {c.phone_number || "-"}</span>
                            {c.id_card_number_customer && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[120px]">{c.id_card_number_customer}</span>
                              </>
                            )}
                          </div>
                        </TableCell>

                        {/* Customer Type Badge */}
                        <TableCell className="py-3.5 px-4 text-center">
                          <CustomerTypeBadge
                            typeName={c.customer_type?.type_name}
                            typeLabel={c.customer_type_label || c.customer_type?.type_label}
                          />
                        </TableCell>

                        {/* Debt vs Credit Limit */}
                        <TableCell className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className={`font-normal ${c.current_debt_amount > 0 ? "text-[#E51C23]" : "text-gray-600"}`}>
                                ฿{c.current_debt_amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-gray-400 font-normal text-[11px]">
                                / ฿{c.max_credit_limit.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>

                            {/* Credit Bar */}
                            <div className="w-full bg-[#F6F3F2] border border-gray-200 h-1.5 rounded-2xl overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isOverLimit
                                    ? "bg-[#E51C23]"
                                    : isNearOrOver
                                    ? "bg-amber-500"
                                    : "bg-slate-500"
                                }`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-light">
                              <span>ใช้ไป {usagePercent.toFixed(0)}%</span>
                              {isOverLimit && (
                                <span className="text-[#E51C23] font-normal">เกินวงเงิน!</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* On-Top Discount Rate */}
                        <TableCell className="py-3.5 px-4 text-center">
                          {c.ontop_discount_rate > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[#1C1B1B] font-normal text-xs">
                              +{c.ontop_discount_rate}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 font-light">0%</span>
                          )}
                        </TableCell>

                        {/* Special Discount Status & Quick Toggle */}
                        <TableCell className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleQuickToggleDiscount(c)}
                            disabled={isUpdating}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-normal transition-all cursor-pointer select-none rounded-none border ${
                              c.is_discount_enabled
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                            }`}
                            title="คลิกเพื่อสลับสถานะเปิด/ปิดสิทธิ์ส่วนลด"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                c.is_discount_enabled ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                              }`}
                            />
                            <span>{c.is_discount_enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
                          </button>
                        </TableCell>

                        {/* Action Buttons */}
                        <TableCell className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit Modal Button */}
                            <button
                              type="button"
                              onClick={() => onOpenEdit(c)}
                              className="p-1.5 text-gray-600 hover:text-[#E51C23] hover:bg-red-50 transition-colors rounded-none cursor-pointer"
                              title="แก้ไขสิทธิ์และส่วนลด"
                            >
                              <Edit size={16} />
                            </button>

                            {/* View Profile Drawer Button */}
                            <button
                              type="button"
                              onClick={() => setDrawerCustomer(c)}
                              className="p-1.5 text-gray-600 hover:text-[#1C1B1B] hover:bg-gray-100 transition-colors rounded-none cursor-pointer"
                              title="ดูข้อมูลโปรไฟล์"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {!isLoading && totalRows > 0 && (
              <div className="bg-[#FCFBFA] px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <Text variant="xs" className="text-[#5F5E5E] mb-0">
                    แสดง {Math.min((page - 1) * limit + 1, totalRows)} ถึง{" "}
                    {Math.min(page * limit, totalRows)} จาก {totalRows} รายการ
                  </Text>
                  <div className="flex items-center gap-2">
                    <Text variant="xs" className="text-[#5F5E5E] mb-0">ต่อหน้า:</Text>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="border border-gray-200 rounded-none px-2 py-1 text-gray-700 bg-white cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 font-medium bg-[#E51C23] text-white text-xs">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* ==================== Edit Discount & Policy Modal ==================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="แก้ไขสิทธิ์และส่วนลดลูกค้า"
        description="ปรับปรุงอัตราส่วนลด On-Top และสถานะสิทธิ์ราคาพิเศษสำหรับลูกค้ารายนี้"
        size="lg"
      >
        {selectedCustomer && (
          <form onSubmit={handleSubmitEdit} className="space-y-5">
            {/* Customer Summary Box */}
            <div className="bg-[#F6F3F2] p-4 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Text variant="small" className="font-semibold text-[#1C1B1B] m-0">
                    {selectedCustomer.customer_name}
                  </Text>
                  <CustomerTypeBadge
                    typeName={selectedCustomer.customer_type?.type_name}
                    typeLabel={selectedCustomer.customer_type_label || selectedCustomer.customer_type?.type_label}
                  />
                </div>
                <Text variant="xs" className="text-[#5F5E5E] font-light m-0 mt-1">
                  เบอร์โทร: {selectedCustomer.phone_number || "-"} | บัตรประชาชน: {selectedCustomer.id_card_number_customer || "-"}
                </Text>
              </div>

              <div className="text-left sm:text-right">
                <Text variant="xs" className="text-gray-500 font-light m-0">
                  ยอดหนี้ค้างชำระ / วงเงิน
                </Text>
                <Text variant="small" className="font-medium text-[#E51C23] m-0">
                  ฿{selectedCustomer.current_debt_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} / ฿{selectedCustomer.max_credit_limit.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
              </div>
            </div>

            {/* Field 1: สิทธิ์ราคาพิเศษ (เปิด/ปิด) */}
            <div className="flex items-center justify-between p-4 border border-gray-200 bg-white">
              <div>
                <Text variant="small" className="font-medium text-[#1C1B1B] m-0">
                  เปิดใช้งานสิทธิ์ส่วนลดพิเศษ
                </Text>
                <Text variant="xs" className="text-[#5F5E5E] font-light m-0 mt-0.5">
                  หากปิดใช้งาน ระบบ POS จะคิดราคาสินค้าตามราคาป้ายปกติโดยไม่บวกส่วนลด On-Top
                </Text>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEditFormData((prev) => ({
                    ...prev,
                    is_discount_enabled: !prev.is_discount_enabled,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  editFormData.is_discount_enabled ? "bg-[#E51C23]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    editFormData.is_discount_enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Field 2: อัตราส่วนลด On-Top (%) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                อัตราส่วนลด On-Top สำหรับลูกค้าอู่/พันธมิตร (%)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={editFormData.ontop_discount_rate}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    ontop_discount_rate: Number(e.target.value) || 0,
                  }))
                }
                rightIcon={<Percent size={16} className="text-gray-400" />}
                className="font-medium text-base text-[#1C1B1B] bg-[#F6F3F2] border border-gray-200"
                helperText="เปอร์เซ็นต์ที่จะนำไปบวกเพิ่มจากส่วนลดปกติของสินค้าแต่ละชิ้นในหน้า POS"
              />
            </div>

            {/* Notice Note */}
            <div className="bg-[#FFDAD6]/30 border border-[#BA1A1A]/20 p-3.5 flex items-start gap-2.5">
              <ShieldCheck className="text-[#E51C23] shrink-0 mt-0.5" size={18} />
              <Text variant="xs" className="text-[#E51C23] font-normal m-0 leading-relaxed">
                <strong>กฎเกณฑ์ของระบบ:</strong> ลูกค้ากลุ่มบริษัท (WHOLESALE) จะไม่ได้รับส่วนลดตามนโยบายร้านค้า สำหรับลูกค้าอู่ (GARAGE) ระบบจะคำนวณส่วนลดรวม = (ส่วนลดสินค้า + On-Top {editFormData.ontop_discount_rate}%) อัตโนมัติ
              </Text>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <Button
                type="button"
                variant="outline-cancel"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-none px-5 h-10 text-xs font-normal"
              >
                ยกเลิก
              </Button>

              <Button
                type="submit"
                variant="solid-red"
                isLoading={isUpdating}
                disabled={isUpdating}
                className="rounded-none px-6 h-10 text-xs font-normal bg-[#E51C23] hover:bg-[#c9151b] text-white"
              >
                บันทึกการเปลี่ยนแปลง
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ==================== Audit History Modal ==================== */}
      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title="ประวัติการแก้ไขสิทธิ์และเครดิตลูกค้า"
        description="บันทึกประวัติการปรับแต่งวงเงินและสิทธิ์ส่วนลดภายในระบบ"
        size="lg"
      >
        {auditLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs font-light">
            <History size={32} className="text-slate-300 mb-2 stroke-[1.5]" />
            <p className="m-0">ยังไม่มีประวัติการแก้ไขการตั้งค่าในระบบ</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col gap-1.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1C1B1B]">{log.customer_name}</span>
                    <span className="text-xs text-gray-400 font-light">โดย {log.changed_by}</span>
                  </div>
                  <span className="text-[#5F5E5E] text-xs font-light">
                    {new Date(log.changed_at).toLocaleString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="text-xs text-[#5F5E5E] font-normal">
                  {log.action}
                </div>

                <div className="text-xs text-[#1C1B1B] font-light bg-[#F6F3F2] p-2.5 leading-relaxed">
                  {log.details}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ==================== Slide-over Customer Detail Drawer ==================== */}
      {drawerCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-none cursor-pointer"
            onClick={() => setDrawerCustomer(null)}
          />

          <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 border-b border-gray-200 flex items-start justify-between bg-white">
                <div>
                  <Heading level="h3" weight="normal" className="text-xl text-[#1C1B1B] mb-0.5">
                    โปรไฟล์และการเงินลูกค้า
                  </Heading>
                  <Text variant="xs" className="text-[#6B7280]">
                    UID: C-{String(drawerCustomer.id).padStart(3, "0")}
                  </Text>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerCustomer(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Details */}
                <div>
                  <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                    ข้อมูลสมาชิก
                  </Text>
                  <Card className="bg-[#F6F3F2] rounded-none border-gray-100 border-l-4 border-l-[#E51C23] shadow-none">
                    <CardContent className="p-4 space-y-1">
                      <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                        {drawerCustomer.customer_name}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        เบอร์โทรศัพท์: {drawerCustomer.phone_number}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        เลขประจำตัว: {drawerCustomer.id_card_number_customer || "-"}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        ประเภท: {drawerCustomer.customer_type_label || drawerCustomer.customer_type?.type_label || "-"}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        ที่อยู่: {drawerCustomer.display_address || "-"}
                      </Text>
                    </CardContent>
                  </Card>
                </div>

                {/* Financial Status Card */}
                <div>
                  <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                    สิทธิประโยชน์และสถานะทางการเงิน
                  </Text>
                  <CustomerCard
                    customer={drawerCustomer as any}
                    address={drawerCustomer.display_address}
                  />
                </div>

                {/* Quick Action in Drawer */}
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="solid-red"
                    leftIcon={<Edit size={16} />}
                    onClick={() => {
                      const cust = drawerCustomer;
                      setDrawerCustomer(null);
                      onOpenEdit(cust);
                    }}
                    className="w-full h-11 bg-[#E51C23] hover:bg-[#c9151b] text-white rounded-none text-sm font-normal"
                  >
                    แก้ไขสิทธิ์และส่วนลดลูกค้ารายนี้
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}