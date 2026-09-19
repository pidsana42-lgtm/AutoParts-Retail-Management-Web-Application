import { useMemo, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, LockKeyhole, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../components/elements/breadcrumb";
import Button from "../../components/elements/button";
import Heading from "../../components/elements/heading";
import Input from "../../components/elements/input";
import { useToast } from "../../components/elements/toast";
import { getMenuByRole } from "../../config/menu";
import { useAuth } from "../../contexts/AuthContexts";
import { profileService } from "../../service/http/profile/profile_service";
import { getApiErrorMessage } from "../../utils/employee";
import AccountFormCard from "./account_form_card";

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordErrors = Partial<Record<keyof PasswordForm, string>>;

const EMPTY_FORM: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangePasswordPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, logout } = useAuth();
  const [form, setForm] = useState<PasswordForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const currentRole = role || localStorage.getItem("role") || "";
  const homePath = getMenuByRole(currentRole)[0]?.path || "/";

  const passwordRules = useMemo(
    () => [
      { label: "อย่างน้อย 8 ตัวอักษร", passed: form.newPassword.length >= 8 },
      { label: "มีตัวอักษรภาษาอังกฤษ", passed: /[a-zA-Z]/.test(form.newPassword) },
      { label: "มีตัวเลขอย่างน้อย 1 ตัว", passed: /\d/.test(form.newPassword) },
    ],
    [form.newPassword]
  );

  const updateField = (field: keyof PasswordForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next: PasswordErrors = {};
    if (!form.currentPassword) next.currentPassword = "กรุณากรอกรหัสผ่านปัจจุบัน";
    if (!passwordRules.every((rule) => rule.passed)) next.newPassword = "รหัสผ่านใหม่ยังไม่ผ่านเงื่อนไข";
    if (form.newPassword === form.currentPassword && form.newPassword) next.newPassword = "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน";
    if (!form.confirmPassword || form.confirmPassword !== form.newPassword) next.confirmPassword = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      toast({ variant: "warning", title: "ข้อมูลยังไม่ถูกต้อง", message: "กรุณาตรวจสอบเงื่อนไขของรหัสผ่าน" });
      return;
    }

    try {
      setIsSaving(true);
      await profileService.changePassword(form.currentPassword, form.newPassword);
      setForm(EMPTY_FORM);
      setErrors({});
      toast({ variant: "success", title: "เปลี่ยนรหัสผ่านสำเร็จ", message: "คุณสามารถใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป" });
      logout();
    } catch (error) {
      toast({ variant: "error", title: "เปลี่ยนรหัสผ่านไม่สำเร็จ", message: getApiErrorMessage(error, "กรุณาตรวจสอบรหัสผ่านปัจจุบันแล้วลองใหม่") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-white font-sans text-gray-800">
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="w-full flex-1 space-y-6 p-6 md:p-8">
          <div className="flex flex-col space-y-2">
            <Breadcrumb
              items={[{ label: "หน้าหลัก", path: homePath }, { label: "เปลี่ยนรหัสผ่าน" }]}
              className="gap-2 text-sm font-light text-gray-500 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-gray-400 [&>span:last-child>span]:font-normal [&>span:last-child>span]:text-black"
            />
            <Heading level="h1" weight="semibold" className="m-0 text-black">เปลี่ยนรหัสผ่าน</Heading>
            <Heading level="h6" className="m-0 mt-1">ตั้งรหัสผ่านใหม่เพื่อรักษาความปลอดภัยของบัญชี</Heading>
          </div>

          <form onSubmit={handleSubmit} noValidate className="grid gap-6 [&_label]:text-xs [&_label]:font-normal">
            <AccountFormCard icon={<LockKeyhole size={18} />} title="ความปลอดภัยของบัญชี" subtitle="ยืนยันรหัสผ่านปัจจุบันก่อนกำหนดรหัสผ่านใหม่">
              <div className="grid items-start gap-6 lg:grid-cols-2">
                <Input
                  label="รหัสผ่านปัจจุบัน"
                  required
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.currentPassword}
                  error={errors.currentPassword}
                  onChange={(event) => updateField("currentPassword", event.target.value)}
                  placeholder="กรอกรหัสผ่านปัจจุบัน"
                  rightIcon={<PasswordToggle visible={showCurrentPassword} onClick={() => setShowCurrentPassword((value) => !value)} />}
                />

                <div className="hidden lg:block" />

                <div>
                  <Input
                    label="รหัสผ่านใหม่"
                    required
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.newPassword}
                    error={errors.newPassword}
                    onChange={(event) => updateField("newPassword", event.target.value)}
                    placeholder="ตั้งรหัสผ่านใหม่ที่คาดเดายาก"
                    rightIcon={<PasswordToggle visible={showNewPassword} onClick={() => setShowNewPassword((value) => !value)} />}
                  />
                  <div className="mt-3 grid gap-1.5">
                    {passwordRules.map((rule) => (
                      <span key={rule.label} className={`flex items-center gap-1.5 text-xs ${rule.passed ? "text-emerald-600" : "text-gray-400"}`}>
                        <Check size={13} strokeWidth={3} /> {rule.label}
                      </span>
                    ))}
                  </div>
                </div>

                <Input
                  label="ยืนยันรหัสผ่านใหม่"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  error={errors.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  rightIcon={<PasswordToggle visible={showConfirmPassword} onClick={() => setShowConfirmPassword((value) => !value)} />}
                />
              </div>
            </AccountFormCard>

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline-cancel" onClick={() => navigate(-1)}>ยกเลิก</Button>
              <Button type="submit" size="lg" isLoading={isSaving} disabled={isSaving} leftIcon={<Save size={18} />} className="min-w-52 text-sm">ยืนยันการเปลี่ยนรหัสผ่าน</Button>
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
