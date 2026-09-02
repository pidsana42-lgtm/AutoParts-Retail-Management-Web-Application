import { useState, useEffect, useMemo, useCallback } from "react";
import { customerApiService } from "../../../../service/http/customer/customer_service";
import type { CustomerTypeItem } from "../../../../interface/customer/customer_interface";
import type {
  CustomerCreditItem,
  CustomerCreditFilter,
  CustomerCreditStats,
  CustomerCreditAuditLog,
  UpdateCustomerDiscountPayload,
  UseCustomerCreditControlReturn,
} from "../../../../interface/storeconfig/customer_credit_interface";

export const useCustomerCreditControl = (): UseCustomerCreditControlReturn => {
  const [customers, setCustomers] = useState<CustomerCreditItem[]>([]);
  const [customerTypes, setCustomerTypes] = useState<CustomerTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [filter, setFilter] = useState<CustomerCreditFilter>({
    search: "",
    customer_type_id: "",
    credit_status: "ALL",
    discount_status: "ALL",
  });

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Modals & Selected items
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCreditItem | null>(null);
  const [drawerCustomer, setDrawerCustomer] = useState<CustomerCreditItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<CustomerCreditAuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState<boolean>(false);

  // Load audit logs from Backend API
  const loadAuditLogs = useCallback(async () => {
    try {
      setIsLoadingAuditLogs(true);
      const logs = await customerApiService.getCustomerCreditAuditLogs();
      setAuditLogs(logs || []);
    } catch (err) {
      console.error("Failed to load customer credit audit logs:", err);
      setAuditLogs([]);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  useEffect(() => {
    if (isAuditModalOpen) {
      loadAuditLogs();
    }
  }, [isAuditModalOpen, loadAuditLogs]);

  // Save an audit log entry to Backend API
  const addAuditLog = async (action: string, customerName: string, details: string, customerId?: number) => {
    try {
      await customerApiService.createCustomerCreditAuditLog({
        customer_id: customerId,
        customer_name: customerName,
        action,
        details,
      });
      loadAuditLogs();
    } catch (e) {
      console.error("Failed to save audit log to backend:", e);
    }
  };

  // Fetch all customers and customer types
  const fetchData = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      const [typesRes, discountCustomers] = await Promise.all([
        customerApiService.getCustomerTypes().catch(() => []),
        customerApiService.getCustomerDiscounts("").catch(() => []),
      ]);

      setCustomerTypes(typesRes || []);

      const mappedCustomers: CustomerCreditItem[] = (discountCustomers || []).map(
        (item: any) => {
          const typeObj: CustomerTypeItem = item.customer_type || {
            id: 1,
            type_name: "GENERAL",
            type_label: "ลูกค้าทั่วไป",
          };

          return {
            id: item.id || item.customer_id,
            customer_id: item.customer_id || item.id,
            customer_name: item.customer_name || "ไม่ระบุชื่อ",
            phone_number: item.phone_number || "-",
            id_card_number_customer: item.id_card_number_customer || "",
            max_credit_limit: Number(item.max_credit_limit) || 0,
            current_debt_amount: Number(item.current_debt_amount) || 0,
            is_discount_enabled: Boolean(item.is_discount_enabled),
            standard_discount_rate: Number(item.standard_discount_rate) || 0,
            ontop_discount_rate: Number(item.ontop_discount_rate) || 0,
            customer_type: typeObj,
            customer_type_label: typeObj.type_label || item.customer_type_label || "ลูกค้าทั่วไป",
            shipping_address: item.shipping_address || "",
            registered_address: item.registered_address || "",
            display_address: item.shipping_address || item.registered_address || "",
          };
        }
      );

      setCustomers(mappedCustomers);
    } catch (err: any) {
      console.error("Failed to load customer credit control data:", err);
      if (!silent) {
        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            "ไม่สามารถโหลดข้อมูลการควบคุมเครดิตลูกค้าได้"
        );
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Auto-refresh: initial load, window focus, and background polling every 30 seconds
  useEffect(() => {
    fetchData(false);

    // Auto-refresh on window focus / tab active
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        fetchData(true);
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    // Auto-polling interval every 30 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchData(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      clearInterval(interval);
    };
  }, [fetchData]);

  // Handle filter changes
  const handleSearchChange = (value: string) => {
    setFilter((prev) => ({ ...prev, search: value }));
    setPage(1);
  };

  const handleCustomerTypeChange = (value: string) => {
    setFilter((prev) => ({ ...prev, customer_type_id: value }));
    setPage(1);
  };

  const handleCreditStatusChange = (value: CustomerCreditFilter["credit_status"]) => {
    setFilter((prev) => ({ ...prev, credit_status: value }));
    setPage(1);
  };

  const handleDiscountStatusChange = (value: CustomerCreditFilter["discount_status"]) => {
    setFilter((prev) => ({ ...prev, discount_status: value }));
    setPage(1);
  };

  const handleResetFilter = () => {
    setFilter({
      search: "",
      customer_type_id: "",
      credit_status: "ALL",
      discount_status: "ALL",
    });
    setPage(1);
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // 1. Search Query
      if (filter.search.trim()) {
        const query = filter.search.toLowerCase().trim();
        const rawQ = query.replace(/[-\s]/g, "");
        const nameMatch = c.customer_name.toLowerCase().includes(query);
        
        const phone = (c.phone_number || "").toLowerCase();
        const rawPhone = phone.replace(/[-\s]/g, "");
        const phoneMatch = phone.includes(query) || (rawQ.length > 0 && rawPhone.includes(rawQ));
        
        const idCard = (c.id_card_number_customer || "").toLowerCase();
        const rawIdCard = idCard.replace(/[-\s]/g, "");
        const idCardMatch = idCard.includes(query) || (rawQ.length > 0 && rawIdCard.includes(rawQ));
        
        const uidMatch = `c-${String(c.id).padStart(3, "0")}`.toLowerCase().includes(query) || String(c.id).includes(rawQ);
        
        if (!nameMatch && !phoneMatch && !idCardMatch && !uidMatch) {
          return false;
        }
      }

      // 2. Customer Type Filter
      if (filter.customer_type_id) {
        if (String(c.customer_type?.id) !== filter.customer_type_id) {
          return false;
        }
      }

      // 3. Credit Status Filter
      if (filter.credit_status === "WITH_DEBT") {
        if (c.current_debt_amount <= 0) return false;
      } else if (filter.credit_status === "NO_DEBT") {
        if (c.current_debt_amount > 0) return false;
      } else if (filter.credit_status === "NEAR_LIMIT") {
        if (
          c.max_credit_limit <= 0 ||
          c.current_debt_amount < c.max_credit_limit * 0.8 ||
          c.current_debt_amount > c.max_credit_limit
        ) {
          return false;
        }
      } else if (filter.credit_status === "OVER_LIMIT") {
        if (c.max_credit_limit <= 0 || c.current_debt_amount <= c.max_credit_limit) {
          return false;
        }
      }

      // 4. Discount Status Filter
      if (filter.discount_status === "ENABLED") {
        if (!c.is_discount_enabled) return false;
      } else if (filter.discount_status === "DISABLED") {
        if (c.is_discount_enabled) return false;
      }

      return true;
    });
  }, [customers, filter]);

  // Paginated customers
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredCustomers.slice(start, start + limit);
  }, [filteredCustomers, page, limit]);

  const totalRows = filteredCustomers.length;
  const totalPages = Math.ceil(totalRows / limit) || 1;

  // Calculated Stats
  const stats: CustomerCreditStats = useMemo(() => {
    let garage = 0;
    let wholesale = 0;
    let general = 0;
    let totalDebt = 0;
    let totalLimit = 0;
    let discountEnabled = 0;
    let nearOrOver = 0;

    customers.forEach((c) => {
      const typeName = c.customer_type?.type_name?.toUpperCase() || "";
      const typeLabel = c.customer_type_label || "";

      if (typeName === "GARAGE" || typeLabel.includes("อู่")) {
        garage++;
      } else if (typeName === "WHOLESALE" || typeLabel.includes("บริษัท")) {
        wholesale++;
      } else {
        general++;
      }

      totalDebt += c.current_debt_amount || 0;
      totalLimit += c.max_credit_limit || 0;

      if (c.is_discount_enabled) {
        discountEnabled++;
      }

      if (c.max_credit_limit > 0 && c.current_debt_amount >= c.max_credit_limit * 0.8) {
        nearOrOver++;
      }
    });

    return {
      totalCustomers: customers.length,
      garageCustomers: garage,
      wholesaleCustomers: wholesale,
      generalCustomers: general,
      totalOutstandingDebt: totalDebt,
      totalCreditLimit: totalLimit,
      discountEnabledCount: discountEnabled,
      nearOrOverLimitCount: nearOrOver,
    };
  }, [customers]);

  // Open Edit Modal
  const handleOpenEditModal = (customer: CustomerCreditItem) => {
    setSelectedCustomer(customer);
    setIsEditModalOpen(true);
  };

  // Update Customer Discount & Credit settings
  const handleUpdateDiscount = async (
    payload: UpdateCustomerDiscountPayload
  ): Promise<boolean> => {
    try {
      setIsUpdating(true);
      setError(null);
      setSuccessMessage(null);

      // Validation
      if (payload.ontop_discount_rate < 0 || payload.ontop_discount_rate > 100) {
        setError("อัตราส่วนลด On-Top ต้องอยู่ระหว่าง 0 - 100%");
        return false;
      }

      const targetCustomer = customers.find((c) => c.id === payload.customerId);
      const customerName = targetCustomer?.customer_name || `รหัส ${payload.customerId}`;

      // Update On-Top discount & Discount Enabled status via PUT /api/customers/:id/discount
      await customerApiService.updateCustomerDiscount(payload.customerId, {
        is_discount_enabled: payload.is_discount_enabled,
        ontop_discount_rate: payload.ontop_discount_rate,
      });

      // If standard_discount_rate is also provided, update via bulk endpoint
      if (payload.standard_discount_rate !== undefined) {
        await customerApiService.bulkUpdateCustomerDiscounts([
          {
            id: payload.customerId,
            standard_discount_rate: payload.standard_discount_rate,
            is_discount_enabled: payload.is_discount_enabled,
          },
        ]);
      }

      // Log audit
      addAuditLog(
        "แก้ไขสิทธิ์และส่วนลดลูกค้า",
        customerName,
        `สถานะสิทธิ์ส่วนลด: ${
          payload.is_discount_enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"
        }, On-Top: ${payload.ontop_discount_rate}%, ส่วนลดมาตรฐาน: ${
          payload.standard_discount_rate ?? targetCustomer?.standard_discount_rate ?? 0
        }%`,
        payload.customerId
      );

      // Update local state directly
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === payload.customerId
            ? {
                ...c,
                is_discount_enabled: payload.is_discount_enabled,
                ontop_discount_rate: payload.ontop_discount_rate,
                standard_discount_rate:
                  payload.standard_discount_rate ?? c.standard_discount_rate,
              }
            : c
        )
      );

      setSuccessMessage(`อัปเดตสิทธิ์และส่วนลดของ ${customerName} สำเร็จแล้ว`);
      setIsEditModalOpen(false);
      return true;
    } catch (err: any) {
      console.error("Failed to update customer discount:", err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "ไม่สามารถบันทึกการเปลี่ยนแปลงสิทธิ์ส่วนลดได้"
      );
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick Toggle Discount status
  const handleQuickToggleDiscount = async (
    customer: CustomerCreditItem
  ): Promise<boolean> => {
    try {
      setIsUpdating(true);
      setError(null);
      setSuccessMessage(null);

      const newStatus = !customer.is_discount_enabled;

      await customerApiService.updateCustomerDiscount(customer.id, {
        is_discount_enabled: newStatus,
        ontop_discount_rate: customer.ontop_discount_rate,
      });

      addAuditLog(
        newStatus ? "เปิดสิทธิ์ส่วนลดพิเศษ" : "ระงับสิทธิ์ส่วนลดพิเศษ",
        customer.customer_name,
        `เปลี่ยนสถานะสิทธิ์ส่วนลดเป็น ${newStatus ? "เปิดใช้งาน (Active)" : "ปิดใช้งาน (Disabled)"}`,
        customer.id
      );

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id ? { ...c, is_discount_enabled: newStatus } : c
        )
      );

      setSuccessMessage(
        `${newStatus ? "เปิดใช้งาน" : "ระงับ"}สิทธิ์ส่วนลดของ ${customer.customer_name} สำเร็จ`
      );
      return true;
    } catch (err: any) {
      console.error("Failed to toggle customer discount status:", err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "ไม่สามารถเปลี่ยนสถานะสิทธิ์ส่วนลดได้"
      );
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    customers,
    filteredCustomers,
    paginatedCustomers,
    customerTypes,
    stats,
    isLoading,
    isUpdating,
    error,
    successMessage,
    filter,
    setFilter,
    handleSearchChange,
    handleCustomerTypeChange,
    handleCreditStatusChange,
    handleDiscountStatusChange,
    handleResetFilter,
    page,
    setPage,
    limit,
    setLimit,
    totalRows,
    totalPages,
    selectedCustomer,
    setSelectedCustomer,
    drawerCustomer,
    setDrawerCustomer,
    isEditModalOpen,
    setIsEditModalOpen,
    isAuditModalOpen,
    setIsAuditModalOpen,
    auditLogs,
    isLoadingAuditLogs,
    handleOpenEditModal,
    handleUpdateDiscount,
    handleQuickToggleDiscount,
    refetch: fetchData,
  };
};
