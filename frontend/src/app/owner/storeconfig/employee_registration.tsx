import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, Eye, EyeOff, LockKeyhole, RefreshCw, UserRound, UserPlus, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../components/elements/breadcrumb";
import Button from "../../../components/elements/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/elements/card";
import Heading from "../../../components/elements/heading";
import Input from "../../../components/elements/input";
import Select from "../../../components/elements/select";
import ImageUploader from "../../../components/elements/image_uploader";
import { useToast } from "../../../components/elements/toast";
import { employeeService } from "../../../service/http/employee/employee_service";
import type { BankOption, FormState } from "../../../interface/employee/employee_registration";
import { digitsOnly, formatBankAccount, formatThaiId, getApiErrorMessage, isValidThaiId } from "../../../utils/employee";
import { BANK_OPTIONS } from "../../../utils/banks";
import { cn } from "../../../utils/component";

type FormErrors = Partial<Record<keyof FormState, string>>;

const PREFIX_OPTIONS = [
  { label: "นาย", value: "นาย" },
  { label: "นาง", value: "นาง" },
  { label: "นางสาว", value: "นางสาว" },
];

const ROLE_OPTIONS = [
  { label: "พนักงาน", value: "Employee" },
  { label: "ผู้จัดการ", value: "Manager" },
];

const EMPTY_FORM: FormState = {
  role: "",
  prefix: "",
  firstName: "",
  lastName: "",
  idCardNumber: "",
  username: "",
  password: "",
  confirmPassword: "",
  lineUserId: "",
  bankId: "",
  bankAccountNumber: "",
  bankAccountName: "",
};

export default function RegisterEmployeePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [metadataError, setMetadataError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordRules = useMemo(
    () => [
      { label: "อย่างน้อย 8 ตัวอักษร", passed: form.password.length >= 8 },
      { label: "มีตัวอักษรภาษาอังกฤษ", passed: /[a-zA-Z]/.test(form.password) },
      { label: "มีตัวเลขอย่างน้อย 1 ตัว", passed: /\d/.test(form.password) },
    ],
    [form.password]
  );

  const completion = useMemo(() => {
    const required = [
      form.role,
      form.prefix,
      form.firstName,
      form.lastName,
      digitsOnly(form.idCardNumber).length === 13 ? form.idCardNumber : "",
      form.username,
      passwordRules.every((rule) => rule.passed) ? form.password : "",
      form.confirmPassword === form.password ? form.confirmPassword : "",
      form.bankId,
      digitsOnly(form.bankAccountNumber).length >= 6 ? form.bankAccountNumber : "",
      form.bankAccountName.trim(),
    ];
    return Math.round((required.filter(Boolean).length / required.length) * 100);
  }, [form, passwordRules]);

  const loadMetadata = async () => {
    try {
      setIsLoadingBanks(true);
      setMetadataError("");
      const metadata = await employeeService.getRegistrationMetadata();
      setBanks(metadata.banks || []);
    } catch (error) {
      setMetadataError(getApiErrorMessage(error, "ไม่สามารถโหลดข้อมูลสำหรับลงทะเบียนได้"));
    } finally {
      setIsLoadingBanks(false);
    }
  };

  useEffect(() => {
    void loadMetadata();
  }, []);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setErrors({});
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!form.role) next.role = "กรุณาเลือกสิทธิ์การใช้งาน";
    if (!form.prefix) next.prefix = "กรุณาเลือกคำนำหน้า";
    if (!form.firstName.trim()) next.firstName = "กรุณากรอกชื่อ";
    if (!form.lastName.trim()) next.lastName = "กรุณากรอกนามสกุล";
    if (!isValidThaiId(form.idCardNumber)) next.idCardNumber = "เลขบัตรประชาชนไม่ถูกต้อง";
    if (!/^[a-zA-Z0-9._-]{4,100}$/.test(form.username.trim())) {
      next.username = "ใช้ตัวอักษรอังกฤษ ตัวเลข . _ - อย่างน้อย 4 ตัว";
    }
    if (!passwordRules.every((rule) => rule.passed)) next.password = "รหัสผ่านยังไม่ผ่านเงื่อนไข";
    if (form.confirmPassword !== form.password || !form.confirmPassword) {
      next.confirmPassword = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
    }
    if (!form.bankId) next.bankId = "กรุณาเลือกธนาคาร";
    const accountDigits = digitsOnly(form.bankAccountNumber);
    if (accountDigits.length < 6 || accountDigits.length > 20) {
      next.bankAccountNumber = "กรุณากรอกเลขบัญชี 6–20 หลัก";
    }
    if (!form.bankAccountName.trim()) {
      next.bankAccountName = "กรุณากรอกชื่อบัญชีธนาคาร";
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
      const employee = await employeeService.create({
        role: form.role as "Employee" | "Manager",
        prefix: form.prefix,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        id_card_number_user: digitsOnly(form.idCardNumber),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        line_user_id: form.lineUserId.trim(),
        bank_id: banks.find((bank) => bank.name === form.bankId)?.id || 0,
        bank_name: form.bankId,
        bank_account_number: digitsOnly(form.bankAccountNumber),
        bank_account_name: form.bankAccountName.trim(),
      });
      if (profileImageFile) {
        try {
          await employeeService.uploadAvatar(employee.id, profileImageFile);
        } catch (uploadError) {
          toast({ variant: "warning", title: "ลงทะเบียนสำเร็จ แต่อัปโหลดรูปไม่สำเร็จ", message: getApiErrorMessage(uploadError, "กรุณาลองเพิ่มรูปจากหน้าแก้ไขข้อมูลอีกครั้ง") });
        }
      }
      toast({
        variant: "success",
        title: "ลงทะเบียนสำเร็จ",
        message: `${employee.first_name} ${employee.last_name} สามารถเข้าสู่ระบบได้แล้ว`,
      });
      navigate("/owner/storeconfig/register-employee", { replace: true });
    } catch (error) {
      toast({ variant: "error", title: "ลงทะเบียนไม่สำเร็จ", message: getApiErrorMessage(error, "ไม่สามารถลงทะเบียนพนักงานได้"), duration: 6000 });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen bg-white font-sans text-gray-800 overflow-x-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="w-full flex-1 space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col space-y-2">
              <Breadcrumb
                items={[
                  { label: "จัดการพนักงาน", path: "/owner/storeconfig/register-employee" },
                  { label: "ลงทะเบียนพนักงานใหม่" },
                ]}
                className="gap-2 text-sm font-light text-gray-500 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-gray-400 [&_a]:hover:text-gray-900 [&>span:last-child>span]:font-normal [&>span:last-child>span]:text-black"
              />
              <Heading level="h1" weight="semibold" className="m-0 text-black">ลงทะเบียนพนักงานใหม่</Heading>
              <Heading level="h6" className="m-0 mt-1">สร้างบัญชีและกำหนดข้อมูลสำหรับเข้าใช้งานระบบ</Heading>
            </div>
            <div className="w-full max-w-xs">
              <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
                <span>ความครบถ้วนของข้อมูล</span><span className="font-medium text-[#E51C23]">{completion}%</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-[#F6F3F2]"><div className="h-full bg-[#E51C23] transition-all duration-300" style={{ width: `${completion}%` }} /></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="grid gap-6 xl:grid-cols-2 [&_label]:text-xs [&_label]:font-normal">
            <FormCard className="xl:col-start-1 xl:row-start-1" icon={<UserRound size={18} />} title="ข้อมูลส่วนตัว" subtitle="ข้อมูลสำหรับระบุตัวตนของพนักงานในระบบ">
              <div className="grid gap-5 sm:grid-cols-3">
                <Select label="คำนำหน้า" required value={form.prefix} error={errors.prefix} placeholder="เลือกคำนำหน้า" options={PREFIX_OPTIONS} onChange={(event) => updateField("prefix", event.target.value)} />
                <Input label="ชื่อ" required autoComplete="given-name" value={form.firstName} error={errors.firstName} onChange={(event) => updateField("firstName", event.target.value)} placeholder="เช่น สมชาย" />
                <Input label="นามสกุล" required autoComplete="family-name" value={form.lastName} error={errors.lastName} onChange={(event) => updateField("lastName", event.target.value)} placeholder="เช่น ใจดี" />
                <Input label="เลขบัตรประชาชน" required inputMode="numeric" value={form.idCardNumber} error={errors.idCardNumber} onChange={(event) => updateField("idCardNumber", formatThaiId(event.target.value))} placeholder="X-XXXX-XXXXX-XX-X" containerClassName="sm:col-span-3" />
              </div>
            </FormCard>

            <FormCard className="xl:col-span-2 xl:row-start-2" icon={<LockKeyhole size={18} />} title="บัญชีเข้าสู่ระบบ" subtitle="ข้อมูลที่พนักงานจะใช้เข้าสู่ระบบ">
              <div className="grid items-start gap-6 lg:grid-cols-2">
                <div className="w-full">
                <ImageUploader
                  label=""
                  variant="document"
                  className="mt-2 lg:min-h-75 lg:p-10"
                  preview={profileImagePreview}
                  onChange={(file) => {
                    setProfileImageFile(file);
                    setProfileImagePreview(URL.createObjectURL(file));
                  }}
                  onClear={() => {
                    setProfileImageFile(null);
                    setProfileImagePreview("");
                  }}
                />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                <Select label="สิทธิ์การใช้งาน" required value={form.role} error={errors.role} placeholder="เลือกสิทธิ์การใช้งาน" options={ROLE_OPTIONS} onChange={(event) => updateField("role", event.target.value)} />
                <Input label="ชื่อผู้ใช้" required autoCapitalize="none" autoComplete="off" value={form.username} error={errors.username} onChange={(event) => updateField("username", event.target.value.replace(/\s/g, ""))} placeholder="เช่น somchai.pos" />
                <div>
                  <Input label="รหัสผ่าน" required type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.password} error={errors.password} onChange={(event) => updateField("password", event.target.value)} placeholder="ตั้งรหัสผ่านที่คาดเดายาก" rightIcon={<PasswordToggle visible={showPassword} onClick={() => setShowPassword((value) => !value)} />} />
                  <div className="mt-3 grid gap-1.5">
                    {passwordRules.map((rule) => <span key={rule.label} className={`flex items-center gap-1.5 text-xs ${rule.passed ? "text-emerald-600" : "text-gray-400"}`}><Check size={13} strokeWidth={3} /> {rule.label}</span>)}
                  </div>
                </div>
                <Input label="ยืนยันรหัสผ่าน" required type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} error={errors.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} placeholder="กรอกรหัสผ่านอีกครั้ง" rightIcon={<PasswordToggle visible={showConfirmPassword} onClick={() => setShowConfirmPassword((value) => !value)} />} />
                <Input label="LINE User ID (ถ้ามี)" value={form.lineUserId} error={errors.lineUserId} onChange={(event) => updateField("lineUserId", event.target.value.trim())} placeholder="เช่น U1234abcd..." helperText="ใช้เชื่อมบัญชีสำหรับเข้าสู่ระบบผ่าน LINE ในอนาคต" containerClassName="sm:col-span-2" />
                </div>
              </div>
            </FormCard>

            <FormCard className="xl:col-start-2 xl:row-start-1" icon={<WalletCards size={18} />} title="ข้อมูลบัญชีธนาคาร" subtitle="ข้อมูลการเงินและการจ่ายค่าตอบแทน">
              <div className="grid gap-5 sm:grid-cols-2">
                <Select label="ธนาคาร" required value={form.bankId} error={errors.bankId} disabled={isLoadingBanks} placeholder="เลือกธนาคาร" options={BANK_OPTIONS} onChange={(event) => updateField("bankId", event.target.value)} />
                <Input label="เลขบัญชีธนาคาร" required inputMode="numeric" value={form.bankAccountNumber} error={errors.bankAccountNumber} onChange={(event) => updateField("bankAccountNumber", formatBankAccount(event.target.value))} placeholder="XXX-XXX-XXXX" />
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-normal text-slate-700">ชื่อบัญชีธนาคาร <span className="text-red-500">*</span></label>
                    <button
                      type="button"
                      disabled={!form.firstName.trim() && !form.lastName.trim()}
                      onClick={() => updateField("bankAccountName", `${form.prefix} ${form.firstName} ${form.lastName}`.trim())}
                      className="cursor-pointer text-xs text-slate-500 hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300"
                    >
                      ใช้ชื่อเดียวกับข้อมูลส่วนตัว
                    </button>
                  </div>
                  <Input value={form.bankAccountName} required error={errors.bankAccountName} onChange={(event) => updateField("bankAccountName", event.target.value)} placeholder="เช่น นายสมชาย ใจดี" />
                </div>
                {metadataError && (
                  <div className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:col-span-2">
                    <span>{metadataError}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadMetadata()}>ลองใหม่</Button>
                  </div>
                )}
              </div>
            </FormCard>

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between xl:col-span-2 xl:row-start-3">
              <Button type="button" variant="outline-cancel" leftIcon={<RefreshCw size={15} />} onClick={resetForm}>ล้างข้อมูล</Button>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="outline-cancel" onClick={() => navigate("/owner/storeconfig/register-employee")}>ยกเลิก</Button>
                <Button type="submit" size="lg" isLoading={isSaving} disabled={isSaving || isLoadingBanks || banks.length === 0} leftIcon={<UserPlus size={18} />} className="min-w-52 text-sm">
                  ยืนยันการลงทะเบียน
                </Button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function PasswordToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer p-1 hover:text-gray-700" aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

function FormCard({ className, icon, title, subtitle, children }: { className?: string; icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className={cn("border border-gray-200 border-l-4 border-l-[#E51C23] bg-white shadow-sm", className)}>
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center bg-red-50 text-[#B70011]">{icon}</span>
          <div><CardTitle className="text-xl font-normal text-[#1C1B1B]">{title}</CardTitle><p className="mt-0.5 text-xs text-gray-500">{subtitle}</p></div>
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  );
}
