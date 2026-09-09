import React, { useEffect, useState } from "react";
import {
  Loader2,
  Save,
  Eye,
  EyeOff,
  ShieldCheck,
  QrCode,
  Building2,
} from "lucide-react";

import Heading from "../../../components/elements/heading";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/elements/card";
import Input from "../../../components/elements/input";
import Select, { type SelectOption } from "../../../components/elements/select";
import Button from "../../../components/elements/button";
import ImageUploader from "../../../components/elements/image_uploader";
import type { CompanySettingReq } from "../../../interface/companysetting/company";
import { companyService, resolveAssetUrl } from "../../../service/http/companysetting/company_service";

const PROMPTPAY_TYPE_OPTIONS: SelectOption[] = [
  { label: "เบอร์โทรศัพท์มือถือ (10 หลัก)", value: "phone" },
  { label: "เลขประจำตัวผู้เสียภาษี / บัตรประชาชน (13 หลัก)", value: "tax_id" },
];

const BANK_OPTIONS: SelectOption[] = [
  { label: "ธนาคารกสิกรไทย (KBANK)", value: "ธนาคารกสิกรไทย (KBANK)" },
  { label: "ธนาคารไทยพาณิชย์ (SCB)", value: "ธนาคารไทยพาณิชย์ (SCB)" },
  { label: "ธนาคารกรุงไทย (KTB)", value: "ธนาคารกรุงไทย (KTB)" },
  { label: "ธนาคารกรุงเทพ (BBL)", value: "ธนาคารกรุงเทพ (BBL)" },
  { label: "ธนาคารกรุงศรีอยุธยา (BAY)", value: "ธนาคารกรุงศรีอยุธยา (BAY)" },
  { label: "ธนาคารทหารไทยธนชาต (TTB)", value: "ธนาคารทหารไทยธนชาต (TTB)" },
  { label: "ธนาคารออมสิน (GSB)", value: "ธนาคารออมสิน (GSB)" },
  { label: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)", value: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)" },
  { label: "ธนาคารยูโอบี (UOB)", value: "ธนาคารยูโอบี (UOB)" },
  { label: "ธนาคารเกียรตินาคินภัทร (KKP)", value: "ธนาคารเกียรตินาคินภัทร (KKP)" },
  { label: "ธนาคารซีไอเอ็มบีไทย (CIMB)", value: "ธนาคารซีไอเอ็มบีไทย (CIMB)" },
  { label: "ธนาคารทิสโก้ (TISCO)", value: "ธนาคารทิสโก้ (TISCO)" },
  { label: "ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)", value: "ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)" },
];

const StoreConfig: React.FC = () => {
  const [formData, setFormData] = useState({
    company_name: "",
    tax_id_number: "",
    address: "",
    phone_number: "",
    email: "",
    logo_url: "",
    promptpay_type: "phone",
    promptpay_number: "",
    promptpay_name: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // สถานะสำหรับ Masking และการเปิดเผยข้อมูล PromptPay (Sensitive Data)
  const [maskedPromptPay, setMaskedPromptPay] = useState("");
  const [revealedPromptPay, setRevealedPromptPay] = useState("");
  const [isPromptPayRevealed, setIsPromptPayRevealed] = useState(false);
  const [isRevealingPromptPay, setIsRevealingPromptPay] = useState(false);
  const [isEditingPromptPay, setIsEditingPromptPay] = useState(false);

  // สถานะสำหรับ Masking และการเปิดเผยข้อมูลบัญชีธนาคาร (Sensitive Data)
  const [maskedBankAccount, setMaskedBankAccount] = useState("");
  const [revealedBankAccount, setRevealedBankAccount] = useState("");
  const [isBankAccountRevealed, setIsBankAccountRevealed] = useState(false);
  const [isRevealingBankAccount, setIsRevealingBankAccount] = useState(false);
  const [isEditingBankAccount, setIsEditingBankAccount] = useState(false);

  // ดึงข้อมูลการตั้งค่าร้านค้าเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    let isMounted = true;

    const fetchCompanySetting = async () => {
      try {
        setIsLoading(true);
        const data = await companyService.getCompanySetting();
        if (isMounted && data) {
          setFormData({
            company_name: data.company_name || "",
            tax_id_number: data.tax_id_number || "",
            address: data.address || "",
            email: data.email || "",
            phone_number: data.phone_number || "",
            logo_url: data.logo_url || "",
            promptpay_type: data.promptpay_type || "phone",
            promptpay_number: "",
            promptpay_name: data.promptpay_name || "",
            bank_name: data.bank_name || "",
            bank_account_number: "",
            bank_account_name: data.bank_account_name || "",
          });
          setMaskedPromptPay(data.promptpay_number_masked || "");
          setMaskedBankAccount(data.bank_account_number_masked || "");

          if (data.logo_url) {
            setLogoPreview(resolveAssetUrl(data.logo_url));
          }
        }
      } catch (err) {
        console.error("Failed to load company setting:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCompanySetting();

    return () => {
      isMounted = false;
    };
  }, []);

  // จัดการ Preview รูปภาพเมื่อผู้ใช้อัปโหลดไฟล์ใหม่
  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTogglePromptPayReveal = async () => {
    if (isPromptPayRevealed) {
      setIsPromptPayRevealed(false);
      return;
    }

    if (revealedPromptPay) {
      setIsPromptPayRevealed(true);
      return;
    }

    try {
      setIsRevealingPromptPay(true);
      const res = await companyService.revealPaymentSetting();
      if (res) {
        setRevealedPromptPay(res.promptpay_number || "");
        setIsPromptPayRevealed(true);
      }
    } catch (err: any) {
      console.error("Failed to reveal payment setting:", err);
      alert(err.response?.data?.error || "ไม่สามารถดึงข้อมูลหมายเลขฉบับเต็มได้");
    } finally {
      setIsRevealingPromptPay(false);
    }
  };

  const handleToggleBankAccountReveal = async () => {
    if (isBankAccountRevealed) {
      setIsBankAccountRevealed(false);
      return;
    }

    if (revealedBankAccount) {
      setIsBankAccountRevealed(true);
      return;
    }

    try {
      setIsRevealingBankAccount(true);
      const res = await companyService.revealPaymentSetting();
      if (res) {
        setRevealedBankAccount(res.bank_account_number || "");
        setIsBankAccountRevealed(true);
      }
    } catch (err: any) {
      console.error("Failed to reveal bank account setting:", err);
      alert(err.response?.data?.error || "ไม่สามารถดึงข้อมูลเลขบัญชีฉบับเต็มได้");
    } finally {
      setIsRevealingBankAccount(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalLogoUrl = formData.logo_url;

      // หากมีไฟล์รูปภาพใหม่ ให้ทำการอัปโหลดก่อน
      if (logoFile) {
        try {
          const uploadRes = await companyService.uploadCompanyLogo(logoFile);
          finalLogoUrl = uploadRes.logo_url || uploadRes.url || "";
        } catch (uploadErr: any) {
          console.error("Failed to upload company logo:", uploadErr);
          alert(uploadErr.message || "อัปโหลดโลโก้ร้านไม่สำเร็จ");
          setIsSaving(false);
          return;
        }
      } else if (!logoPreview) {
        // หากผู้ใช้กดลบรูปภาพออก
        finalLogoUrl = "";
      }

      const payload: CompanySettingReq = {
        ...formData,
        logo_url: finalLogoUrl,
        promptpay_number: isEditingPromptPay
          ? formData.promptpay_number
          : isPromptPayRevealed
          ? revealedPromptPay
          : maskedPromptPay,
        bank_account_number: isEditingBankAccount
          ? formData.bank_account_number
          : isBankAccountRevealed
          ? revealedBankAccount
          : maskedBankAccount,
      };

      const result = await companyService.updateCompanySetting(payload);
      if (result) {
        setFormData({
          company_name: result.company_name || "",
          tax_id_number: result.tax_id_number || "",
          address: result.address || "",
          email: result.email || "",
          phone_number: result.phone_number || "",
          logo_url: result.logo_url || "",
          promptpay_type: result.promptpay_type || "phone",
          promptpay_number: "",
          promptpay_name: result.promptpay_name || "",
          bank_name: result.bank_name || "",
          bank_account_number: "",
          bank_account_name: result.bank_account_name || "",
        });
        setMaskedPromptPay(result.promptpay_number_masked || "");
        setMaskedBankAccount(result.bank_account_number_masked || "");
        setIsEditingPromptPay(false);
        setIsPromptPayRevealed(false);
        setRevealedPromptPay("");
        setIsEditingBankAccount(false);
        setIsBankAccountRevealed(false);
        setRevealedBankAccount("");

        setLogoFile(null);
        if (result.logo_url) {
          setLogoPreview(resolveAssetUrl(result.logo_url));
        } else {
          setLogoPreview("");
        }
      }

      alert("บันทึกข้อมูลร้านสำเร็จ");
    } catch (err: any) {
      console.error("Failed to save company setting:", err);
      const errMsg = err.response?.data?.error || err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      alert(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white p-8 font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-red-700" />
          <p className="text-sm">กำลังโหลดข้อมูลร้านค้า...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-white p-8 font-sans">
      {/* Header พร้อมปุ่มบันทึกด้านบน */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
            ตั้งค่าข้อมูลร้าน
          </Heading>
          <Heading level="h6" weight="light" className="m-0 mt-1 text-slate-500">
            จัดการข้อมูลร้านที่จะแสดงบนเอกสารและระบบ
          </Heading>
        </div>

        <Button
          type="submit"
          form="company-setting-form"
          disabled={isSaving}
          className="w-full sm:w-auto"
        >
          {isSaving ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>กำลังบันทึก...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Save size={16} />
              <span>บันทึกข้อมูลร้าน</span>
            </div>
          )}
        </Button>
      </div>

      <form id="company-setting-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Company Info Card */}
        <Card className="border-l-[5px] border-l-red-600">
          <CardHeader>
            <CardTitle className="text-xl font-normal">ข้อมูลร้าน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="ชื่อร้าน"
                name="company_name"
                required
                value={formData.company_name}
                onChange={handleChange}
                placeholder="เช่น ร้าน เจ.เจ. อะไหล่ยนต์"
              />
              <Input
                label="เลขประจำตัวผู้เสียภาษี (Tax ID)"
                name="tax_id_number"
                required
                value={formData.tax_id_number}
                onChange={handleChange}
                placeholder="เช่น 0105565012345"
              />
              <Input
                label="อีเมล"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="เช่น contact@autopart.co.th"
              />
              <Input
                label="เบอร์โทรศัพท์"
                name="phone_number"
                required
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="เช่น 021234567"
              />
            </div>
            <Input
              label="ที่อยู่"
              name="address"
              required
              value={formData.address}
              onChange={handleChange}
              placeholder="เช่น 123 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900"
            />
          </CardContent>
        </Card>

        {/* Payment & Bank Settings Card */}
        <Card className="border-l-[5px] border-l-red-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl font-normal flex items-center gap-2">
                <QrCode className="h-5 w-5 text-red-600" />
                <span>ตั้งค่าข้อมูลการชำระเงินและพร้อมเพย์ (Payment Settings)</span>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1 mb-0">
                กำหนดหมายเลขพร้อมเพย์สำหรับสร้าง QR Code และข้อมูลบัญชีธนาคารสำหรับแสดงประกอบใต้ QR Code และในใบเสร็จรับเงิน
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Security Notice */}
            <div className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 text-slate-600 text-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">ระบบความปลอดภัยข้อมูล: </span>
                หมายเลขพร้อมเพย์และเลขบัญชีธนาคารจะถูกเข้ารหัสลับ (AES-256) ก่อนบันทึกลงฐานข้อมูล และระบบจะทำ Masking ซ่อนตัวเลขสำคัญอัตโนมัติเพื่อความปลอดภัยจากการแอบมอง (กดไอคอนรูปตาเพื่อดูเลขเต็ม)
              </div>
            </div>

            {/* 1. PromptPay Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-slate-800">1. ข้อมูลพร้อมเพย์ (สำหรับสร้าง QR Code สแกนชำระเงิน)</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* PromptPay Type */}
                <Select
                  label="ประเภทพร้อมเพย์"
                  value={formData.promptpay_type || "phone"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, promptpay_type: e.target.value }))}
                  options={PROMPTPAY_TYPE_OPTIONS}
                />

                {/* PromptPay Number */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-normal text-slate-700">หมายเลขพร้อมเพย์</label>
                    {isEditingPromptPay ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPromptPay(false);
                          setFormData((prev) => ({ ...prev, promptpay_number: "" }));
                        }}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        ยกเลิกแก้ไข
                      </button>
                    ) : (
                      maskedPromptPay && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingPromptPay(true);
                            setIsPromptPayRevealed(false);
                            setFormData((prev) => ({ ...prev, promptpay_number: "" }));
                          }}
                          className="text-xs text-blue-600 hover:underline cursor-pointer"
                        >
                          เปลี่ยนหมายเลข
                        </button>
                      )
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      name="promptpay_number"
                      value={
                        isEditingPromptPay
                          ? formData.promptpay_number
                          : isPromptPayRevealed
                          ? revealedPromptPay
                          : (maskedPromptPay || formData.promptpay_number || "")
                      }
                      onChange={(e) => {
                        setIsEditingPromptPay(true);
                        setIsPromptPayRevealed(false);
                        setFormData((prev) => ({ ...prev, promptpay_number: e.target.value }));
                      }}
                      placeholder={formData.promptpay_type === "tax_id" ? "เช่น 0105565012345" : "เช่น 0812345678"}
                      rightIcon={
                        maskedPromptPay && !isEditingPromptPay ? (
                          <button
                            type="button"
                            onClick={handleTogglePromptPayReveal}
                            disabled={isRevealingPromptPay}
                            className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                            title={isPromptPayRevealed ? "ซ่อนตัวเลข" : "แสดงตัวเลขฉบับเต็ม"}
                          >
                            {isRevealingPromptPay ? (
                              <Loader2 size={16} className="animate-spin text-red-600" />
                            ) : isPromptPayRevealed ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        ) : undefined
                      }
                    />
                  </div>
                </div>

                {/* PromptPay Name */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-normal text-slate-700">ชื่อบัญชีพร้อมเพย์</label>
                    {formData.company_name && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, promptpay_name: prev.company_name }))}
                        className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                        title="ใช้ชื่อร้านที่กรอกไว้ข้างบน"
                      >
                        ใช้ชื่อร้าน
                      </button>
                    )}
                  </div>
                  <Input
                    name="promptpay_name"
                    value={formData.promptpay_name || ""}
                    onChange={handleChange}
                    placeholder="เช่น เจเจ อะไหล่ยนต์"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/80"></div>

            {/* 2. Bank Account Details Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-700" />
                <span className="text-sm font-semibold text-slate-800">2. ข้อมูลบัญชีธนาคาร (สำหรับแสดงประกอบใต้ QR Code และในใบเสร็จ)</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Bank Name Dropdown */}
                <Select
                  label="ธนาคาร"
                  placeholder="-- เลือกธนาคาร --"
                  value={formData.bank_name || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bank_name: e.target.value }))}
                  options={BANK_OPTIONS}
                />

                {/* Bank Account Number */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-normal text-slate-700">เลขที่บัญชีธนาคาร</label>
                    {isEditingBankAccount ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingBankAccount(false);
                          setFormData((prev) => ({ ...prev, bank_account_number: "" }));
                        }}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        ยกเลิกแก้ไข
                      </button>
                    ) : (
                      maskedBankAccount && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingBankAccount(true);
                            setIsBankAccountRevealed(false);
                            setFormData((prev) => ({ ...prev, bank_account_number: "" }));
                          }}
                          className="text-xs text-blue-600 hover:underline cursor-pointer"
                        >
                          เปลี่ยนหมายเลข
                        </button>
                      )
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      name="bank_account_number"
                      value={
                        isEditingBankAccount
                          ? formData.bank_account_number
                          : isBankAccountRevealed
                          ? revealedBankAccount
                          : (maskedBankAccount || formData.bank_account_number || "")
                      }
                      onChange={(e) => {
                        setIsEditingBankAccount(true);
                        setIsBankAccountRevealed(false);
                        setFormData((prev) => ({ ...prev, bank_account_number: e.target.value }));
                      }}
                      placeholder="เช่น 123-4-56789-0"
                      rightIcon={
                        maskedBankAccount && !isEditingBankAccount ? (
                          <button
                            type="button"
                            onClick={handleToggleBankAccountReveal}
                            disabled={isRevealingBankAccount}
                            className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                            title={isBankAccountRevealed ? "ซ่อนตัวเลข" : "แสดงตัวเลขฉบับเต็ม"}
                          >
                            {isRevealingBankAccount ? (
                              <Loader2 size={16} className="animate-spin text-red-600" />
                            ) : isBankAccountRevealed ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        ) : undefined
                      }
                    />
                  </div>
                </div>

                {/* Bank Account Name */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-normal text-slate-700">ชื่อบัญชีธนาคาร</label>
                    {formData.company_name && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, bank_account_name: prev.company_name }))}
                        className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                        title="ใช้ชื่อร้านที่กรอกไว้ข้างบน"
                      >
                        ใช้ชื่อร้าน
                      </button>
                    )}
                  </div>
                  <Input
                    name="bank_account_name"
                    value={formData.bank_account_name || ""}
                    onChange={handleChange}
                    placeholder="เช่น นาย/บจก. เจเจ อะไหล่ยนต์"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logo Card */}
        <Card className="border-l-[5px] border-l-red-600">
          <CardHeader>
            <CardTitle className="text-xl font-normal">โลโก้ร้าน</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUploader
              label="อัปโหลดโลโก้ร้าน"
              className="w-full rounded-none"
              variant="document"
              preview={logoPreview}
              onChange={(file) => setLogoFile(file)}
              onClear={() => {
                setLogoFile(null);
                setLogoPreview("");
                setFormData((prev) => ({ ...prev, logo_url: "" }));
              }}
            />
            <p className="text-[12px] text-red-600">* แนะนำให้ใช้รูปภาพที่ไม่มีพื้นหลังหรือพื้นหลังสีขาวเท่านั้น เพื่อความสะดวกในการใช้งาน</p>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default StoreConfig;
