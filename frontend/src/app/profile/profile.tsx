import { useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Save, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../components/elements/breadcrumb";
import Button from "../../components/elements/button";
import Heading from "../../components/elements/heading";
import ImageUploader from "../../components/elements/image_uploader";
import Input from "../../components/elements/input";
import Select from "../../components/elements/select";
import { useToast } from "../../components/elements/toast";
import { getMenuByRole } from "../../config/menu";
import { useAuth } from "../../contexts/AuthContexts";
import { resolveAssetUrl } from "../../service/http/companysetting/company_service";
import { profileService } from "../../service/http/profile/profile_service";
import { BANK_OPTIONS } from "../../utils/banks";
import { digitsOnly, formatBankAccount, formatThaiId, getApiErrorMessage, isValidThaiId } from "../../utils/employee";
import AccountFormCard from "./account_form_card";
import { usePathBasePrefix } from "../../utils/usePathBasePrefix";

type ProfileForm = {
  prefix: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: string;
  idCardNumber: string;
  lineUserId: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
};

type ProfileErrors = Partial<Record<"prefix" | "firstName" | "lastName" | "email" | "idCardNumber" | "bankName" | "bankAccountNumber" | "bankAccountName", string>>;

const EMPTY_FORM: ProfileForm = {
  prefix: "",
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  role: "",
  idCardNumber: "",
  lineUserId: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
};

const PREFIX_OPTIONS = [
  { label: "นาย", value: "นาย" },
  { label: "นาง", value: "นาง" },
  { label: "นางสาว", value: "นางสาว" },
];

export default function ProfilePage(): React.JSX.Element {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, setUser } = useAuth();
  const basePath = usePathBasePrefix();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<ProfileForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [initialProfileImagePath, setInitialProfileImagePath] = useState("");
  const [shouldDeleteProfileImage, setShouldDeleteProfileImage] = useState(false);

  const currentRole = role || localStorage.getItem("role") || "";
  const homePath = getMenuByRole(currentRole)[0]?.path || "/";
  const showBankDetails = form.role.toUpperCase() !== "OWNER";

  useEffect(() => {
    let isActive = true;
    profileService
      .get()
      .then((profile) => {
        if (!isActive) return;
        const loadedForm = {
          prefix: profile.prefix || "",
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          username: profile.username || "",
          email: profile.email || "",
          role: profile.role || "",
          idCardNumber: formatThaiId(profile.id_card_number_user || ""),
          lineUserId: profile.line_user_id || "",
          bankName: profile.bank_name || "",
          bankAccountNumber: formatBankAccount(profile.bank_account_number || ""),
          bankAccountName: profile.bank_account_name || "",
        };
        const imagePath = profile.profile_image_path || "";
        setForm(loadedForm);
        setInitialForm(loadedForm);
        setInitialProfileImagePath(imagePath);
        setProfileImagePreview(imagePath ? resolveAssetUrl(imagePath) : "");
      })
      .catch((error) => {
        if (isActive) {
          toast({ variant: "error", title: "โหลดข้อมูลไม่สำเร็จ", message: getApiErrorMessage(error, "ไม่สามารถโหลดข้อมูลโปรไฟล์ได้") });
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [toast]);

  useEffect(() => {
    return () => {
      if (profileImagePreview.startsWith("blob:")) URL.revokeObjectURL(profileImagePreview);
    };
  }, [profileImagePreview]);

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next: ProfileErrors = {};
    if (!form.prefix) next.prefix = "กรุณาเลือกคำนำหน้า";
    if (!form.firstName.trim()) next.firstName = "กรุณากรอกชื่อ";
    if (!form.lastName.trim()) next.lastName = "กรุณากรอกนามสกุล";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    if (!isValidThaiId(form.idCardNumber)) next.idCardNumber = "เลขบัตรประชาชนต้องมี 13 หลัก";
    if (showBankDetails) {
      if (!form.bankName) next.bankName = "กรุณาเลือกธนาคาร";
      const bankAccountDigits = digitsOnly(form.bankAccountNumber);
      if (bankAccountDigits.length < 6 || bankAccountDigits.length > 20) next.bankAccountNumber = "เลขบัญชีธนาคารต้องมี 6 ถึง 20 หลัก";
      if (!form.bankAccountName.trim()) next.bankAccountName = "กรุณากรอกชื่อบัญชีธนาคาร";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      toast({ variant: "warning", title: "ข้อมูลยังไม่ครบ", message: "กรุณาตรวจสอบช่องที่ระบบทำเครื่องหมายไว้" });
      return;
    }

    try {
      setIsSaving(true);
      const profile = await profileService.update({
        prefix: form.prefix,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        id_card_number_user: digitsOnly(form.idCardNumber),
        line_user_id: form.lineUserId.trim(),
        bank_name: form.bankName,
        bank_account_number: digitsOnly(form.bankAccountNumber),
        bank_account_name: form.bankAccountName.trim(),
      });

      let profileImagePath = initialProfileImagePath;
      if (profileImageFile) {
        profileImagePath = await profileService.uploadAvatar(profileImageFile);
      } else if (shouldDeleteProfileImage && initialProfileImagePath) {
        await profileService.deleteAvatar();
        profileImagePath = "";
      }

      const updatedUser = {
        id: String(profile.id),
        username: profile.username,
        first_name: profile.first_name,
        last_name: profile.last_name,
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        profile_image_path: profileImagePath,
      };
      const nextStoredUser = { ...user, ...updatedUser };
      setUser(nextStoredUser);
      localStorage.setItem("user", JSON.stringify(nextStoredUser));

      const savedForm = {
        prefix: profile.prefix,
        firstName: profile.first_name,
        lastName: profile.last_name,
        username: profile.username,
        email: profile.email,
        role: profile.role,
        idCardNumber: formatThaiId(profile.id_card_number_user),
        lineUserId: profile.line_user_id || "",
        bankName: profile.bank_name,
        bankAccountNumber: formatBankAccount(profile.bank_account_number),
        bankAccountName: profile.bank_account_name,
      };
      setForm(savedForm);
      setInitialForm(savedForm);
      setInitialProfileImagePath(profileImagePath);
      setProfileImageFile(null);
      setShouldDeleteProfileImage(false);
      setProfileImagePreview(profileImagePath ? resolveAssetUrl(profileImagePath) : "");
      toast({ variant: "success", title: "บันทึกสำเร็จ", message: "อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว" });
      navigate(`${basePath}/dashboard/maindashboard`)
    } catch (error) {
      toast({ variant: "error", title: "บันทึกไม่สำเร็จ", message: getApiErrorMessage(error, "ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้") });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setProfileImageFile(null);
    setShouldDeleteProfileImage(false);
    setProfileImagePreview(initialProfileImagePath ? resolveAssetUrl(initialProfileImagePath) : "");
  };

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-white font-sans text-gray-800">
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="w-full flex-1 space-y-6 p-6 md:p-8">
          <div className="flex flex-col space-y-2">
            <Breadcrumb
              items={[{ label: "หน้าหลัก", path: homePath }, { label: "แก้ไขโปรไฟล์" }]}
              className="gap-2 text-sm font-light text-gray-500 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-gray-400 [&_a]:hover:text-gray-900 [&>span:last-child>span]:font-normal [&>span:last-child>span]:text-black"
            />
            <Heading level="h1" weight="semibold" className="m-0 text-black">แก้ไขโปรไฟล์</Heading>
            <Heading level="h6" className="m-0 mt-1">จัดการรูปโปรไฟล์ ข้อมูลส่วนตัว และชื่อที่แสดงในระบบ</Heading>
          </div>

          <form onSubmit={handleSubmit} noValidate className="grid gap-6 [&_label]:text-xs [&_label]:font-normal">
            <AccountFormCard icon={<UserRound size={18} />} title="ข้อมูลโปรไฟล์" subtitle="จัดการรูปโปรไฟล์และข้อมูลบัญชีของคุณ">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-gray-400">กำลังโหลดข้อมูลโปรไฟล์...</p>
              ) : (
                <div className="grid items-start gap-6 lg:grid-cols-2">
                  <div className="w-full">
                    <p className="mb-2 text-xs font-normal text-slate-700">รูปโปรไฟล์</p>
                    <ImageUploader
                      label=""
                      variant="profile"
                      className="max-h-96"
                      preview={profileImagePreview}
                      onChange={(file) => {
                        setProfileImageFile(file);
                        setShouldDeleteProfileImage(false);
                        setProfileImagePreview(URL.createObjectURL(file));
                      }}
                      onClear={() => {
                        setProfileImageFile(null);
                        setProfileImagePreview("");
                        setShouldDeleteProfileImage(true);
                      }}
                    />
                    <p className="mt-2 text-xs font-light text-[#5B5B5B]">รองรับไฟล์ JPG, PNG, WEBP หรือ GIF ขนาดไม่เกิน 5MB</p>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid gap-5 border-b border-gray-100 pb-5 sm:grid-cols-2">
                      <Input label="ชื่อผู้ใช้" value={form.username} disabled />
                      <Input label="สิทธิ์การใช้งาน" value={form.role} disabled />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-3">
                      <Select label="คำนำหน้า" required value={form.prefix} error={errors.prefix} placeholder="เลือกคำนำหน้า" options={PREFIX_OPTIONS} onChange={(event) => updateField("prefix", event.target.value)} />
                      <Input label="ชื่อ" required autoComplete="given-name" value={form.firstName} error={errors.firstName} onChange={(event) => updateField("firstName", event.target.value)} placeholder="เช่น สมชาย" />
                      <Input label="นามสกุล" required autoComplete="family-name" value={form.lastName} error={errors.lastName} onChange={(event) => updateField("lastName", event.target.value)} placeholder="เช่น ใจดี" />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Input label="เลขบัตรประชาชน" required inputMode="numeric" value={form.idCardNumber} error={errors.idCardNumber} onChange={(event) => updateField("idCardNumber", formatThaiId(event.target.value))} placeholder="X-XXXX-XXXXX-XX-X" containerClassName="sm:col-span-2" />
                      <Input label="อีเมล" required type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(event) => updateField("email", event.target.value)} placeholder="เช่น somchai@example.com" />
                      <Input label="LINE User ID (ถ้ามี)" value={form.lineUserId} onChange={(event) => updateField("lineUserId", event.target.value.trim())} placeholder="เช่น U1234abcd..." />
                    </div>

                    {showBankDetails && (
                      <>
                        <div className="border-t border-gray-100 pt-5">
                          <p className="text-sm font-medium text-[#1C1B1B]">ข้อมูลบัญชีธนาคาร</p>
                          <p className="mt-0.5 text-xs text-gray-500">ข้อมูลสำหรับการเงินและการจ่ายค่าตอบแทน</p>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <Select label="ธนาคาร" required value={form.bankName} error={errors.bankName} placeholder="เลือกธนาคาร" options={BANK_OPTIONS} onChange={(event) => updateField("bankName", event.target.value)} />
                          <Input label="เลขบัญชีธนาคาร" required inputMode="numeric" value={form.bankAccountNumber} error={errors.bankAccountNumber} onChange={(event) => updateField("bankAccountNumber", formatBankAccount(event.target.value))} placeholder="XXX-XXX-XXXX" />
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <div className="flex items-center justify-between gap-3">
                              <label className="text-xs font-normal text-slate-700">
                                ชื่อบัญชีธนาคาร <span className="text-red-500">*</span>
                              </label>
                              <button
                                type="button"
                                disabled={!form.firstName.trim() && !form.lastName.trim()}
                                onClick={() => updateField("bankAccountName", `${form.prefix} ${form.firstName} ${form.lastName}`.replace(/\s+/g, " ").trim())}
                                className="cursor-pointer text-xs text-slate-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300"
                              >
                                ใช้ชื่อเดียวกับข้อมูลส่วนตัว
                              </button>
                            </div>
                            <Input value={form.bankAccountName} required error={errors.bankAccountName} onChange={(event) => updateField("bankAccountName", event.target.value)} placeholder="เช่น นายสมชาย ใจดี" />
                          </div>
                        </div>
                      </>
                    )}

                  </div>
                </div>
              )}
            </AccountFormCard>

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline-cancel" leftIcon={<RefreshCw size={15} />} onClick={resetForm}>คืนค่าข้อมูล</Button>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="outline-cancel" onClick={() => navigate(-1)}>ยกเลิก</Button>
                <Button type="submit" size="lg" isLoading={isSaving} disabled={isLoading || isSaving} leftIcon={<Save size={18} />} className="min-w-52 text-sm">บันทึกการเปลี่ยนแปลง</Button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
