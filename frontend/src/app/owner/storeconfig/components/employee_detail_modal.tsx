import { useEffect, useState } from "react";
import { Edit3, LockKeyhole, Save, X } from "lucide-react";
import Button from "../../../../components/elements/button";
import Input from "../../../../components/elements/input";
import Modal from "../../../../components/elements/modal";
import Select from "../../../../components/elements/select";
import ImageUploader from "../../../../components/elements/image_uploader";
import { employeeService } from "../../../../service/http/employee/employee_service";
import { formatDate } from "../../../../utils/formatdate";
import type { CreatedEmployee, EmployeeDetail, UpdateEmployeeRequest } from "../../../../interface/employee/employee_registration";
import { formatBankAccount, formatThaiId, getApiErrorMessage } from "../../../../utils/employee";
import { BANK_OPTIONS } from "../../../../utils/banks";
import { resolveAssetUrl } from "../../../../service/http/companysetting/company_service";

interface EmployeeDetailModalProps {
  employee: CreatedEmployee | null;
  onClose: () => void;
  onSaved?: () => void;
}

const PREFIX_OPTIONS = ["นาย", "นาง", "นางสาว"].map((value) => ({ label: value, value }));
const ROLE_OPTIONS = [{ label: "พนักงาน", value: "Employee" }, { label: "ผู้จัดการ", value: "Manager" }];

export default function EmployeeDetailModal({ employee, onClose, onSaved }: EmployeeDetailModalProps) {
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [verifiedPassword, setVerifiedPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState<UpdateEmployeeRequest | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");

  useEffect(() => {
    setDetail(null);
    setPassword("");
    setError("");
    setVerifiedPassword("");
    setIsEditing(false);
    setEditError("");
    setEditForm(null);
    setProfileImageFile(null);
    setProfileImagePreview("");
  }, [employee]);

  const handleClose = () => {
    if (!isVerifying) onClose();
  };

  const verifyAndLoad = async () => {
    if (!employee || !password) {
      setError("กรุณากรอกรหัสผ่านของเจ้าของร้าน");
      return;
    }
    try {
      setIsVerifying(true);
      setError("");
      const loadedDetail = await employeeService.getDetails(employee.id, password);
      setDetail(loadedDetail);
      setVerifiedPassword(password);
      setEditForm(toEditForm(loadedDetail, password));
      setProfileImagePreview(loadedDetail.profile_image_path ? resolveAssetUrl(loadedDetail.profile_image_path) : "");
      setPassword("");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "ไม่สามารถยืนยันตัวตนได้"));
      setPassword("");
    } finally {
      setIsVerifying(false);
    }
  };

  const updateEditField = (field: keyof UpdateEmployeeRequest, value: string | number) => {
    setEditForm((current) => current ? { ...current, [field]: value } : current);
  };

  const saveChanges = async () => {
    if (!employee || !editForm) return;
    try {
      setIsSaving(true);
      setEditError("");
      const updated = await employeeService.update(employee.id, { ...editForm, password: verifiedPassword });
      let savedDetail = updated;
      if (profileImageFile) {
        const profileImagePath = await employeeService.uploadAvatar(employee.id, profileImageFile);
        savedDetail = { ...updated, profile_image_path: profileImagePath };
      }
      setDetail(savedDetail);
      setEditForm(toEditForm(savedDetail, verifiedPassword));
      setProfileImageFile(null);
      setProfileImagePreview(savedDetail.profile_image_path ? resolveAssetUrl(savedDetail.profile_image_path) : "");
      setIsEditing(false);
      onSaved?.();
    } catch (requestError) {
      setEditError(getApiErrorMessage(requestError, "ไม่สามารถบันทึกข้อมูลพนักงานได้"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={employee !== null}
      onClose={handleClose}
      size={detail ? "lg" : "sm"}
      title={detail ? "ข้อมูลพนักงาน" : "ยืนยันตัวตนก่อนดูข้อมูล"}
      description={detail
        ? `${detail.first_name} ${detail.last_name}`
        : `กรอกรหัสผ่านของเจ้าของร้านเพื่อดูข้อมูลของ ${employee?.first_name || "พนักงาน"}`}
      footer={detail ? (
        <>
          {isEditing ? (
            <Button type="button" variant="outline-cancel" onClick={() => { setIsEditing(false); setEditError(""); setProfileImageFile(null); setProfileImagePreview(detail?.profile_image_path ? resolveAssetUrl(detail.profile_image_path) : ""); if (detail) setEditForm(toEditForm(detail, verifiedPassword)); }} disabled={isSaving} leftIcon={<X size={15} />}>ยกเลิก</Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIsEditing(true)} leftIcon={<Edit3 size={15} />}>แก้ไข</Button>
          )}
          {isEditing && (
            <Button type="button" variant="solid-red" onClick={() => void saveChanges()} isLoading={isSaving} leftIcon={<Save size={15} />}>บันทึก</Button>
          )}
        </>
      ) : (
        <>
          <Button type="button" variant="outline-cancel" onClick={handleClose} disabled={isVerifying}>ยกเลิก</Button>
          <Button type="button" variant="solid-red" onClick={() => void verifyAndLoad()} isLoading={isVerifying} disabled={!password}>
            ยืนยัน
          </Button>
        </>
      )}
    >
      {detail ? (
        <div className="space-y-5">
          <div className="flex justify-center border-b border-gray-200 pb-5">
            {isEditing ? (
              <div className="w-48">
                <ImageUploader
                  label=""
                  variant="profile"
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
                {!profileImagePreview && <p className="mt-2 text-center text-xs font-normal text-slate-700">อัปโหลดรูปโปรไฟล์</p>}
              </div>
            ) : detail.profile_image_path ? (
              <img src={resolveAssetUrl(detail.profile_image_path)} alt="รูปโปรไฟล์พนักงาน" className="h-40 w-40 rounded-none object-cover ring-4 ring-red-50" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-none bg-red-50 text-5xl font-semibold text-[#B70011] ring-4 ring-red-50">
                {detail.first_name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          {isEditing && editForm ? (
            <div className="grid gap-4 sm:grid-cols-2 [&_label]:font-normal [&_label]:text-[12px] [&_label]:text-gray-500">
              <Select label="สิทธิ์การใช้งาน" value={editForm.role} options={ROLE_OPTIONS} onChange={(event) => updateEditField("role", event.target.value)} />
              <Select label="คำนำหน้า" value={editForm.prefix} options={PREFIX_OPTIONS} onChange={(event) => updateEditField("prefix", event.target.value)} />
              <Input label="ชื่อ" value={editForm.first_name} onChange={(event) => updateEditField("first_name", event.target.value)} />
              <Input label="นามสกุล" value={editForm.last_name} onChange={(event) => updateEditField("last_name", event.target.value)} />
              <Input label="เลขบัตรประชาชน" value={formatThaiId(editForm.id_card_number_user)} onChange={(event) => updateEditField("id_card_number_user", event.target.value.replace(/\D/g, ""))} />
              <Select label="ธนาคาร" value={editForm.bank_name} options={BANK_OPTIONS} onChange={(event) => updateEditField("bank_name", event.target.value)} />
              <Input label="เลขบัญชีธนาคาร" value={formatBankAccount(editForm.bank_account_number)} onChange={(event) => updateEditField("bank_account_number", event.target.value.replace(/\D/g, ""))} />
              <Input label="ชื่อบัญชีธนาคาร" value={editForm.bank_account_name} onChange={(event) => updateEditField("bank_account_name", event.target.value)} />
              <Input label="LINE User ID" value={editForm.line_user_id} onChange={(event) => updateEditField("line_user_id", event.target.value)} />
              {editError && <p className="text-xs text-red-600 sm:col-span-2">{editError}</p>}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="คำนำหน้า" value={detail.prefix || "-"} />
              <DetailField label="ชื่อ-นามสกุล" value={`${detail.first_name} ${detail.last_name}`} />
              <DetailField label="ชื่อผู้ใช้" value={detail.username} />
              <DetailField label="เลขบัตรประชาชน" value={formatThaiId(detail.id_card_number_user)} sensitive />
              <DetailField label="สิทธิ์การใช้งาน" value={detail.role === "Employee" ? "พนักงาน" : detail.role} />
              <DetailField label="ธนาคาร" value={detail.bank_name || "-"} />
              <DetailField label="เลขบัญชีธนาคาร" value={formatBankAccount(detail.bank_account_number) || "-"} sensitive />
              <DetailField label="ชื่อบัญชีธนาคาร" value={detail.bank_account_name || "-"} />
              <DetailField label="LINE User ID" value={detail.line_user_id || "ยังไม่เชื่อมต่อ"} />
              <DetailField label="วันที่ลงทะเบียน" value={formatDate(detail.created_at)} />
            </div>
          )}
          <div className="border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            ข้อมูลส่วนบุคคลนี้แสดงหลังยืนยันรหัสผ่านเท่านั้น กรุณาไม่เปิดเผยหรือบันทึกข้อมูลโดยไม่ได้รับอนุญาต
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-red-50 p-4">
            <LockKeyhole size={20} className="mt-0.5 shrink-0 text-[#B70011]" />
            <p className="text-xs leading-5 text-gray-600">
              ระบบจะตรวจรหัสผ่านกับบัญชีเจ้าของร้านที่กำลังเข้าสู่ระบบ และจะโหลดรายละเอียดหลังตรวจสอบสำเร็จเท่านั้น
            </p>
          </div>
          <Input
            label="รหัสผ่านเจ้าของร้าน"
            required
            autoFocus
            autoComplete="current-password"
            type="text"
            value={password}
            error={error}
            onChange={(event) => { setPassword(event.target.value); setError(""); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void verifyAndLoad();
              }
            }}
            placeholder="กรอกรหัสผ่านเพื่อยืนยัน"
          />
        </div>
      )}
    </Modal>
  );
}

function DetailField({ label, value, sensitive = false }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div className="border-b border-gray-200 pb-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 break-all text-sm font-normal text-black ${sensitive ? "tracking-wide" : ""}`}>{value}</p>
    </div>
  );
}

function toEditForm(detail: EmployeeDetail, password: string): UpdateEmployeeRequest {
  return {
    role: detail.role === "Manager" ? "Manager" : "Employee",
    prefix: detail.prefix || "นาย",
    first_name: detail.first_name,
    last_name: detail.last_name,
    id_card_number_user: detail.id_card_number_user,
    line_user_id: detail.line_user_id || "",
    bank_id: 0,
    bank_name: detail.bank_name || "",
    bank_account_number: detail.bank_account_number,
    bank_account_name: detail.bank_account_name || "",
    password,
  };
}
