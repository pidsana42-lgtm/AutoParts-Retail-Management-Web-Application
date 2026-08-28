import { useState, useEffect, useMemo } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { customerApiService } from "../../../../service/http/customer/customer_service";
import type {
  CustomerTypeItem,
  CustomerListItem,
  RegisterCustomerRequest,
} from "../../../../interface/customer/customer_interface";

export const useCustomerRegistration = () => {
  const [types, setTypes] = useState<CustomerTypeItem[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // --- Registration Form State ---
  const [formData, setFormData] = useState<RegisterCustomerRequest>({
    customer_name: "",
    customer_type_id: 1,
    phone_number: "",
    id_card_number_customer: "",
    registered_address: "",
    shipping_address: "",
  });

  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // --- Filter & Search States ---
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("");
  const [debtFilter, setDebtFilter] = useState<string>("");

  // --- Pagination & Drawer States ---
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [typeList, customerList] = await Promise.all([
        customerApiService.getCustomerTypes(),
        customerApiService.getCustomers(),
      ]);
      setTypes(typeList);
      setCustomers(customerList);
      if (typeList.length > 0) {
        setFormData((prev) => ({ ...prev, customer_type_id: typeList[0].id }));
      }
    } catch (err) {
      console.error("Fetch customers error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const formatPhoneNumber = (val: string): string => {
    const raw = val.replace(/\D/g, "").slice(0, 10);
    if (raw.length <= 3) return raw;
    return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  };

  const formatIdCardNumber = (val: string): string => {
    const raw = val.replace(/\D/g, "").slice(0, 13);
    if (raw.length <= 1) return raw;
    if (raw.length <= 5) return `${raw.slice(0, 1)}-${raw.slice(1)}`;
    if (raw.length <= 10) return `${raw.slice(0, 1)}-${raw.slice(1, 5)}-${raw.slice(5)}`;
    if (raw.length <= 12) return `${raw.slice(0, 1)}-${raw.slice(1, 5)}-${raw.slice(5, 10)}-${raw.slice(10)}`;
    return `${raw.slice(0, 1)}-${raw.slice(1, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 12)}-${raw.slice(12, 13)}`;
  };

  const validateField = (name: string, val?: any) => {
    const value = val !== undefined ? val : (formData as any)[name];
    let errMsg = "";
    if (name === "customer_name" && (!value || !String(value).trim())) {
      errMsg = "กรุณากรอกชื่อลูกค้า/อู่ซ่อมรถ/บริษัท";
    } else if (name === "customer_type_id" && !value) {
      errMsg = "กรุณาเลือกประเภทลูกค้า";
    } else if (name === "phone_number") {
      const raw = String(value || "").replace(/\D/g, "");
      if (!raw) {
        errMsg = "กรุณากรอกหมายเลขโทรศัพท์หลัก";
      } else if (raw.length !== 10) {
        errMsg = "กรุณากรอกหมายเลขโทรศัพท์ให้ครบ 10 หลัก (XXX-XXXXXXX)";
      }
    } else if (name === "id_card_number_customer") {
      const raw = String(value || "").replace(/\D/g, "");
      if (!raw) {
        errMsg = "กรุณากรอกเลขประจำตัวประชาชน (13 หลัก)";
      } else if (raw.length !== 13) {
        errMsg = "กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก (X-XXXX-XXXXX-XX-X)";
      }
    } else if (name === "registered_address" && (!value || !String(value).trim())) {
      errMsg = "กรุณากรอกที่อยู่ตามทะเบียนบ้าน";
    } else if (name === "shipping_address" && (!value || !String(value).trim())) {
      errMsg = "กรุณากรอกที่อยู่จัดส่ง / ที่ตั้งอู่";
    }

    if (errMsg) {
      setErrors((prev) => ({ ...prev, [name]: errMsg }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    return !errMsg;
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let val: any = value;
    if (name === "customer_type_id") {
      val = Number(value);
    } else if (name === "phone_number") {
      val = formatPhoneNumber(value);
    } else if (name === "id_card_number_customer") {
      val = formatIdCardNumber(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
    if (errors[name]) {
      validateField(name, val);
    }
  };

  const handleBlur = (name: string) => {
    validateField(name);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIdCardFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setFormData({
      customer_name: "",
      customer_type_id: types[0]?.id || 1,
      phone_number: "",
      id_card_number_customer: "",
      registered_address: "",
      shipping_address: "",
    });
    setIdCardFile(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.customer_name?.trim()) {
      newErrors.customer_name = "กรุณากรอกชื่อลูกค้า/อู่ซ่อมรถ/บริษัท";
    }
    if (!formData.customer_type_id) {
      newErrors.customer_type_id = "กรุณาเลือกประเภทลูกค้า";
    }
    const rawPhone = (formData.phone_number || "").replace(/\D/g, "");
    if (!rawPhone) {
      newErrors.phone_number = "กรุณากรอกหมายเลขโทรศัพท์หลัก";
    } else if (rawPhone.length !== 10) {
      newErrors.phone_number = "กรุณากรอกหมายเลขโทรศัพท์ให้ครบ 10 หลัก (XXX-XXXXXXX)";
    }

    const rawIdCard = (formData.id_card_number_customer || "").replace(/\D/g, "");
    if (!rawIdCard) {
      newErrors.id_card_number_customer = "กรุณากรอกเลขประจำตัวประชาชน (13 หลัก)";
    } else if (rawIdCard.length !== 13) {
      newErrors.id_card_number_customer = "กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก (X-XXXX-XXXXX-XX-X)";
    }

    if (!formData.registered_address?.trim()) {
      newErrors.registered_address = "กรุณากรอกที่อยู่ตามทะเบียนบ้าน";
    }
    if (!formData.shipping_address?.trim()) {
      newErrors.shipping_address = "กรุณากรอกที่อยู่จัดส่ง / ที่ตั้งอู่";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    setSubmitting(true);

    try {
      const payload: RegisterCustomerRequest = {
        customer_name: formData.customer_name.trim(),
        customer_type_id: Number(formData.customer_type_id),
        phone_number: formData.phone_number.trim(),
        id_card_number_customer: formData.id_card_number_customer.trim(),
        registered_address: formData.registered_address.trim(),
        shipping_address: formData.shipping_address.trim(),
      };

      await customerApiService.registerCustomer(payload);
      alert("ลงทะเบียนสมาชิกสำเร็จ");
      handleReset();
      fetchInitialData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลงทะเบียน: " + (err.response?.data?.error || err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Filter Handlers ---
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleCustomerTypeChange = (value: string) => {
    setCustomerTypeFilter(value);
    setPage(1);
  };

  const handleDebtFilterChange = (value: string) => {
    setDebtFilter(value);
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
  };

  // --- Filtered & Paginated Customer List ---
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      // 1. ค้นหาชื่อลูกค้า / เบอร์โทรศัพท์ / เลขบัตรประชาชน / ที่อยู่
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rawQ = q.replace(/[-\s]/g, "");
        const name = (customer.customer_name || "").toLowerCase();
        const phone = (customer.phone_number || "").toLowerCase();
        const rawPhone = phone.replace(/[-\s]/g, "");
        const idCard = (customer.id_card_number_customer || "").toLowerCase();
        const rawIdCard = idCard.replace(/[-\s]/g, "");
        const address = (customer.display_address || "").toLowerCase();

        const matchName = name.includes(q);
        const matchPhone = phone.includes(q) || (rawQ.length > 0 && rawPhone.includes(rawQ));
        const matchIdCard = idCard.includes(q) || (rawQ.length > 0 && rawIdCard.includes(rawQ));
        const matchAddress = address.includes(q);

        if (!matchName && !matchPhone && !matchIdCard && !matchAddress) {
          return false;
        }
      }

      // 2. ประเภทลูกค้า
      if (customerTypeFilter) {
        const typeId = customer.customer_type?.id || (customer as any).customer_type_id;
        if (String(typeId) !== String(customerTypeFilter)) {
          return false;
        }
      }

      // 3. สถานะหนี้ค้างชำระ
      if (debtFilter === "HAS_DEBT") {
        if (!customer.current_debt_amount || customer.current_debt_amount <= 0) {
          return false;
        }
      } else if (debtFilter === "NO_DEBT") {
        if (customer.current_debt_amount && customer.current_debt_amount > 0) {
          return false;
        }
      }

      return true;
    });
  }, [customers, searchQuery, customerTypeFilter, debtFilter]);

  const totalRows = filteredCustomers.length;
  const totalPages = Math.ceil(totalRows / limit) || 1;
  const paginatedCustomers = filteredCustomers.slice((page - 1) * limit, page * limit);

  return {
    // Types & Data
    types,
    customers,
    filteredCustomers,
    paginatedCustomers,
    loading,
    submitting,

    // Form
    formData,
    idCardFile,
    errors,
    setErrors,
    handleInputChange,
    handleBlur,
    validateField,
    handleFileChange,
    handleReset,
    handleSubmit,

    // Filters
    searchQuery,
    setSearchQuery,
    customerTypeFilter,
    setCustomerTypeFilter,
    debtFilter,
    setDebtFilter,
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

    // Refetch
    refetch: fetchInitialData,
  };
};