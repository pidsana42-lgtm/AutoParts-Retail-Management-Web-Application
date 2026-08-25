import React, { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import Heading from "../../../components/elements/heading";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/elements/card";
import Input from "../../../components/elements/input";
import Button from "../../../components/elements/button";
import ImageUploader from "../../../components/elements/image_uploader";
import type { CompanySettingReq } from "../../../interface/companysetting/company";
import { companyService, resolveAssetUrl } from "../../../service/http/companysetting/company_service";

const CompanySetting: React.FC = () => {
  const [formData, setFormData] = useState<CompanySettingReq>({
    company_name: "",
    tax_id_number: "",
    address: "",
    email: "",
    phone_number: "",
    logo_url: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
          });
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
        });
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

        {/* Logo Card */}
        <Card className="border-l-[5px] border-l-red-600">
          <CardHeader>
            <CardTitle className="text-xl font-normal">โลโก้ร้าน</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUploader
              label="อัปโหลดโลโก้ร้าน"
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

export default CompanySetting;
