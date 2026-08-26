import { useState, useEffect } from "react";
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

  const [formData, setFormData] = useState<RegisterCustomerRequest>({
    customer_name: "",
    customer_type_id: 1,
    phone_number: "",
    id_card_number_customer: "",
    registered_address: "",
    shipping_address: "",
  });

  const [idCardFile, setIdCardFile] = useState<File | null>(null);

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

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "customer_type_id" ? Number(value) : value,
    }));
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
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("customer_name", formData.customer_name);
      payload.append("customer_type_id", String(formData.customer_type_id));
      payload.append("phone_number", formData.phone_number);
      payload.append("id_card_number_customer", formData.id_card_number_customer);
      payload.append("registered_address", formData.registered_address);
      payload.append("shipping_address", formData.shipping_address);

      if (idCardFile) {
        payload.append("id_card_image", idCardFile);
      }

      await customerApiService.registerCustomer(payload);
      alert("ลงทะเบียนสมาชิกสำเร็จ");
      handleReset();
      fetchInitialData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลงทะเบียน: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    types,
    customers,
    loading,
    submitting,
    formData,
    idCardFile,
    handleInputChange,
    handleFileChange,
    handleReset,
    handleSubmit,
  };
};