import { useRef } from "react";
import {
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  ScanBarcode,
  X,
} from "lucide-react";

// Components
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Input from "../../../components/elements/input";
import Select from "../../../components/elements/select";
import Button from "../../../components/elements/button";
// import Badge from "../../../components/elements/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../../components/elements/table";
import { Card, CardContent } from "../../../components/elements/card";
import { CustomerTypeBadge } from "../../../components/elements/status_badge";
import { CustomerCard } from "../pos/components/customercard";

// Hook & Types
import { useCustomerRegistration } from "./hook/useCustomerRegustration";

export default function CustomerRegistration() {
  const {
    // Types & Data
    types,
    customers,
    paginatedCustomers,
    loading,
    submitting,

    // Form
    formData,
    idCardFile,
    errors,
    handleInputChange,
    handleBlur,
    handleFileChange,
    handleReset,
    handleSubmit,

    // Filters
    searchQuery,
    customerTypeFilter,
    debtFilter,
    handleSearchChange,
    handleCustomerTypeChange,
    handleDebtFilterChange,
    handleSearch,

    // Pagination
    page,
    setPage,
    limit,
    setLimit,
    totalRows,
    totalPages,

    // Details Modal
    selectedCustomer,
    setSelectedCustomer,
  } = useCustomerRegistration();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  

  return (
    <div className="relative flex min-h-screen bg-white text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Section Header */}
          <div>
            <Heading level='h1' weight='semibold' className='m-0 text-black'>
              การลงทะเบียนสมาชิกใหม่
            </Heading>
            <Heading level='h6' className='m-0 mt-1'>
              การลงทะเบียนนิติบุคคลเชิงพาณิชย์ใหม่หรือลูกค้าปลีกรายใหม่
            </Heading>
          </div>

          {/* Form Bar */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1: ข้อมูลทั่วไป */}
              <Card className="bg-white rounded-none shadow-none border-y border-r border-gray-200 overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-3">
                    <span className="bg-[#1C1B1B] text-white text-sm px-2 py-1 rounded-none font-normal">
                      01
                    </span>
                    <Heading level="h3" weight="normal" className=" text-[#1C1B1B] mb-0">
                      ข้อมูลทั่วไป
                    </Heading>
                  </div>

                  {/* กรอกข้อมูลชื่อลูกค้า */}
                  <div className="space-y-1.5">
                    <Text className="text-xs text-[#5F5E5E] mb-1">
                      ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท <span className="text-[#E51C23] font-normal">*</span>
                    </Text>
                    <Input
                      name="customer_name"
                      placeholder="ระบุชื่อ-นามสกุล หรือชื่อนิติบุคคล"
                      value={formData.customer_name}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur("customer_name")}
                      error={errors.customer_name}
                      className="w-full h-10 bg-[#F6F3F2] border border-gray-200 rounded-none text-sm text-[#1C1B1B] placeholder:text-[#6B7280] placeholder:font-light focus:border-[#E51C23] focus:ring-1 focus:ring-[#E51C23]"
                    />
                  </div>

                  {/* กรอกข้อมูลประเภทลูกค้า */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#5F5E5E]">
                      ประเภทลูกค้า <span className="text-[#E51C23] font-normal">*</span>
                    </label>
                    <Select
                      value={String(formData.customer_type_id)}
                      onChange={(e: any) =>
                        handleInputChange({
                          target: { name: "customer_type_id", value: e.target.value },
                        } as any)
                      }
                      error={errors.customer_type_id}
                        className="w-full h-10 bg-[#F6F3F2] border-none rounded-none text-sm text-[#1C1B1B] cursor-pointer focus:outline-none focus:ring-0"                      options={types.map((t) => ({
                        label: t.type_label || t.type_name,
                        value: String(t.id),
                      }))}
                    />
                  </div>
                  
                  {/* กรอกข้อมูลหมายเลขโทรศัพท์หลัก */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#5F5E5E]">
                      หมายเลขโทรศัพท์หลัก <span className="text-[#E51C23] font-normal">*</span>
                    </label>
                    <Input
                      type="tel"
                      name="phone_number"
                      placeholder="0XX-XXXXXXX"
                      maxLength={11}
                      value={formData.phone_number}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur("phone_number")}
                      error={errors.phone_number}
                      className="w-full h-10 bg-[#F6F3F2] border-none rounded-none text-sm text-[#1C1B1B] placeholder:text-[#6B7280] placeholder:font-light focus:border-[#E51C23] focus:ring-1 focus:ring-[#E51C23]"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 02: ข้อมูลส่วนบุคคล */}
              <Card className="bg-white rounded-none shadow-none border-y border-r border-gray-200 overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2  pb-3">
                    <span className="bg-[#1C1B1B] text-white text-sm px-2 py-1 rounded-none font-normal">
                      02
                    </span>
                    <Heading level="h3" weight="normal" className=" text-[#1C1B1B] mb-0">
                      ข้อมูลส่วนบุคคล / ทะเบียน
                    </Heading>
                  </div>

                  {/* กรอกข้อมูลบัตรประจำตัวประชาชน */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#5F5E5E]">
                      บัตรประจำตัวประชาชน (13 หลัก) <span className="text-[#E51C23] font-normal">*</span>
                    </label>
                    <Input
                      name="id_card_number_customer"
                      placeholder="X-XXXX-XXXXX-XX-X"
                      maxLength={17}
                      value={formData.id_card_number_customer}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur("id_card_number_customer")}
                      error={errors.id_card_number_customer}
                      className="w-full h-10 bg-[#F6F3F2] border border-gray-200 rounded-none text-sm text-[#1C1B1B] placeholder:text-[#6B7280] placeholder:font-light focus:border-[#E51C23] focus:ring-1 focus:ring-[#E51C23]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#5F5E5E]">
                        ที่อยู่ตามทะเบียนบ้าน <span className="text-[#E51C23] font-normal">*</span>
                      </label>
                      <textarea
                        name="registered_address"
                        rows={3}
                        placeholder="ป้อนที่อยู่เต็มตามบัตรประชาชน..."
                        value={formData.registered_address}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur("registered_address")}
                        className={`w-full p-2.5 bg-[#F6F3F2] border-none rounded-none text-sm text-[#1C1B1B] placeholder:text-[#6B7280] placeholder:font-light resize-none outline-none transition-colors ${
                          errors.registered_address
                            ? "!border-red-500 !border-solid ring-1 ring-red-500"
                            : "border-gray-200 focus:border-[#E51C23] focus:ring-1 focus:ring-[#E51C23]"
                        }`}
                      />
                      {errors.registered_address && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.registered_address}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-[#5F5E5E]">
                        ที่อยู่จัดส่ง / ที่ตั้งอู่ <span className="text-[#E51C23] font-normal">*</span>
                      </label>
                      <textarea
                        name="shipping_address"
                        rows={3}
                        placeholder="ที่อยู่ปลายทางการจัดส่งหรือที่ตั้งหน้าร้าน..."
                        value={formData.shipping_address}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur("shipping_address")}
                        className={`w-full p-2.5 bg-[#F6F3F2] border-none rounded-none text-sm text-[#1C1B1B] placeholder:text-[#6B7280] placeholder:font-light resize-none outline-none transition-colors ${
                          errors.shipping_address
                            ? "!border-red-500 !border-solid ring-1 ring-red-500"
                            : "border-gray-200 focus:border-[#E51C23] focus:ring-1 focus:ring-[#E51C23]"
                        }`}
                      />
                      {errors.shipping_address && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.shipping_address}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 03: การอัปโหลดเอกสาร */}
            <Card className="bg-white rounded-none shadow-none border-y border-r border-gray-200 overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 pb-3">
                   <span className="bg-[#1C1B1B] text-white text-sm px-2 py-1 rounded-none font-normal">
                    03
                  </span>
                  <Heading level="h3" weight="normal" className=" text-[#1C1B1B] mb-0">
                    การอัปโหลดเอกสาร
                  </Heading>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-[#E7BDB8] bg-white hover:bg-red-50/20 transition-colors p-8 flex flex-col items-center justify-center cursor-pointer"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <UploadCloud className="w-10 h-10 text-[#5B5B5B] mb-2 stroke-[1.5]" />
                  <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                    {idCardFile ? idCardFile.name : "คลิกเพื่ออัปโหลดสำเนาบัตรประชาชน / ภ.พ.20"}
                  </Text>
                  <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                    PDF, JPG, PNG (ขนาดไม่เกิน 10MB)
                  </Text>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline-cancel"
                onClick={handleReset}
                className="px-6 h-10 border border-gray-200 text-[#5F5E5E] hover:bg-gray-100 font-normal rounded-none"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                variant="solid-red"
                disabled={submitting}
                className="px-6 h-10 bg-[#E51C23] hover:bg-[#c9151b] text-white font-normal rounded-none"
              >
                {submitting ? "กำลังบันทึก..." : "บันทึกการลงทะเบียนสมาชิก"}
              </Button>
            </div>
          </form>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* ค้นหาชื่อลูกค้า / เบอร์โทร / เลขบัตรประชาชน (col-span-5) */}
                <div className="md:col-span-5 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E]">
                    ค้นหาชื่อลูกค้า / หมายเลขโทรศัพท์ / เลขประจำตัวประชาชน
                  </Text>
                  <div className="relative flex-1">
                    <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="สแกนบาร์โค้ด / ชื่อลูกค้า / เบอร์โทร หรือ เลขประจำตัวประชาชน"
                      className="w-full h-11 bg-white border border-gray-200 rounded-none pl-12 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm transition-all placeholder:text-[#6B7280]"
                    />
                  </div>
                </div>

                {/* ประเภทลูกค้า (col-span-3) */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E]">
                    ประเภทลูกค้า
                  </Text>
                  <Select
                    value={customerTypeFilter}
                    onChange={(e: any) => handleCustomerTypeChange(e.target.value)}
                    placeholder="ประเภทลูกค้าทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
                    options={[
                      { label: "ประเภทลูกค้าทั้งหมด", value: "" },
                      ...types.map((t) => ({
                        label: t.type_label || t.type_name,
                        value: String(t.id),
                      })),
                    ]}
                  />
                </div>

                {/* สถานะหนี้ค้างชำระ (col-span-2) */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E]">
                    สถานะหนี้ค้างชำระ
                  </Text>
                  <Select
                    value={debtFilter}
                    onChange={(e: any) => handleDebtFilterChange(e.target.value)}
                    placeholder="สถานะทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "มียอดหนี้ค้างชำระ", value: "HAS_DEBT" },
                      { label: "ไม่มีหนี้ค้างชำระ", value: "NO_DEBT" },
                    ]}
                  />
                </div>

                {/* ปุ่มค้นหา (col-span-2) */}
                <div className="md:col-span-2">
                  <Button
                    onClick={handleSearch}
                    className="w-full h-11 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-sm cursor-pointer"
                  >
                    ค้นหา
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Table List */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            {/* Table Content */}
            <Table className="!w-full !min-w-0 table-fixed text-left border-collapse">
              <TableHeader className="bg-[#F6F3F2] border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-4 w-[25%]">ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท</TableHead>
                  <TableHead className="py-3 px-4 w-[15%]">หมายเลขโทรศัพท์</TableHead>
                  <TableHead className="py-3 px-4 w-[18%]">หมายเลขประจำตัวประชาชน</TableHead>
                  <TableHead className="py-3 px-4 w-[22%]">ที่อยู่</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[12%]">ประเภทลูกค้า</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[8%]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-200">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Text variant="small" className="text-gray-500 mb-0">
                        กำลังโหลดข้อมูลสมาชิก...
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : paginatedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Text variant="small" className="text-gray-400 mb-0">
                        {customers.length === 0
                          ? "ยังไม่มีข้อมูลสมาชิกในระบบ"
                          : "ไม่พบข้อมูลสมาชิกที่ตรงกับเงื่อนไขการค้นหา"}
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCustomers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="py-3.5 px-4 truncate">
                        <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">
                          {c.customer_name}
                        </Text>
                        {/* <Text variant="xs" className="font-light text-[#A8A29E] mb-0">
                          UID: C-{String(c.id).padStart(3, "0")}
                        </Text> */} 
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-sm text-[#1C1B1B]">
                        {c.phone_number || "-"}
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-sm text-[#5F5E5E]">
                        {c.id_card_number_customer || "-"} 
                      </TableCell>
                      <TableCell className="py-3.5 px-4 truncate">
                        <Text variant="xs" className="text-[#5F5E5E] truncate mb-0">
                          {c.display_address || "-"}
                        </Text>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-center">
                        <CustomerTypeBadge
                          typeName={c.customer_type?.type_name}
                          typeLabel={c.customer_type_label || c.customer_type?.type_label}
                        />
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="inline-flex items-center justify-center p-1.5 text-[#E51C23] hover:text-[#c9151b] hover:bg-red-50 transition-colors rounded-full"
                          title="ดูรายละเอียดลูกค้า"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {!loading && totalRows > 0 && (
              <div className="bg-[#FCFBFA] px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <Text variant="xs" className="text-[#5F5E5E] mb-0">
                    แสดง {Math.min((page - 1) * limit + 1, totalRows)} ถึง{" "}
                    {Math.min(page * limit, totalRows)} จาก {totalRows} รายการ
                  </Text>
                  <div className="flex items-center gap-2">
                    <Text variant="xs" className="text-[#5F5E5E] mb-0">รายการต่อหน้า:</Text>
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
                    {page}
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

      {/* ==================== SLIDE-OVER CUSTOMER DETAILS DRAWER ==================== */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-none cursor-pointer"
            onClick={() => setSelectedCustomer(null)}
          />

          <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 border-b border-[#E7BDB8] flex items-start justify-between bg-white">
                <div>
                  <Heading level="h3" weight="normal" className="text-xl text-[#1C1B1B] mb-0.5">
                    โปรไฟล์ลูกค้า
                  </Heading>
                  {/* <Text variant="xs" className="text-[#6B7280]">
                    UID: C-{String(selectedCustomer.id).padStart(3, "0")}
                  </Text> */}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                    ข้อมูลสมาชิก
                  </Text>
                  <Card className="bg-[#F6F3F2] rounded-none border-gray-100 border-l-4 border-l-[#E51C23] shadow-none">
                    <CardContent className="p-4 space-y-1">
                      <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                        {selectedCustomer.customer_name}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        เบอร์โทรศัพท์: {selectedCustomer.phone_number}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        เลขประจำตัว: {selectedCustomer.id_card_number_customer || "-"}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        ประเภท: {selectedCustomer.customer_type_label || selectedCustomer.customer_type?.type_label || "-"}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        ที่อยู่: {selectedCustomer.display_address || "-"}
                      </Text>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                    สิทธิประโยชน์และวงเงิน
                  </Text>
                  <CustomerCard
                    customer={selectedCustomer as any}
                    address={selectedCustomer.display_address}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}