import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Badge from "../../../components/elements/badge";
import Button from "../../../components/elements/button";
import { Card } from "../../../components/elements/card";
import Heading from "../../../components/elements/heading";
import Input from "../../../components/elements/input";
import { employeeService } from "../../../service/http/employee/employee_service";
import type { CreatedEmployee } from "../../../interface/employee/employee_registration";
import EmployeeDetailModal from "./components/employee_detail_modal";
import EmployeeTable from "./components/employee_table";
import { getApiErrorMessage } from "../../../utils/employee";

export default function EmployeeManagementPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<CreatedEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<CreatedEmployee | null>(null);

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      setError("");
      const result = await employeeService.list();
      setEmployees(result.employees || []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "ไม่สามารถโหลดรายชื่อพนักงานได้"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    if (!keyword) return employees;
    return employees.filter((employee) =>
      `${employee.first_name} ${employee.last_name} ${employee.username}`
        .toLocaleLowerCase("th")
        .includes(keyword)
    );
  }, [employees, search]);

  return (
    <div className="relative flex min-h-screen bg-white font-sans text-slate-800 overflow-x-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="w-full flex-1 space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Heading level="h1" weight="semibold" className="m-0 text-black">จัดการพนักงาน</Heading>
              <Heading level="h6" className="m-0 mt-1">รายชื่อพนักงานทั้งหมดที่ลงทะเบียนภายในร้าน</Heading>
            </div>
            <Button
              type="button"
              variant="solid-red"
              leftIcon={<UserPlus size={18} />}
              onClick={() => navigate("/owner/storeconfig/register-employee/new")}
              className="h-11 px-5 text-sm"
            >
              ลงทะเบียนพนักงานเพิ่ม
            </Button>
          </div>

          <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-[#E51C23]" />
                  <h1 className="text-lg font-normal text-[#1C1B1B]">รายชื่อพนักงาน</h1>
                  <Badge variant="primary" size="auto" className="text-sm">{employees.length} คน</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">คลิกแถวพนักงานเพื่อยืนยันรหัสผ่านและเปิดรายละเอียด</p>
              </div>
              <div className="w-full sm:w-80">
                <Input aria-label="ค้นหาพนักงาน" leftIcon={<Search size={16} />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรือชื่อผู้ใช้..." />
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse bg-slate-100" />)}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <RefreshCw size={28} className="text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">โหลดรายชื่อพนักงานไม่สำเร็จ</p>
                <p className="mt-1 text-xs text-slate-500">{error}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadEmployees()} className="mt-4">ลองใหม่อีกครั้ง</Button>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                {search ? <Search size={34} className="text-slate-300" /> : <Users size={34} className="text-slate-300" />}
                <p className="mt-4 text-sm font-medium text-slate-800">{search ? "ไม่พบพนักงานที่ค้นหา" : "ยังไม่มีพนักงานในร้าน"}</p>
                <p className="mt-1 text-xs text-slate-500">{search ? "ลองค้นหาด้วยชื่อหรือชื่อผู้ใช้อื่น" : "ลงทะเบียนพนักงานเพื่อสร้างบัญชีแรกของร้าน"}</p>
              </div>
            ) : (
              <EmployeeTable employees={filteredEmployees} onView={setSelectedEmployee} />
            )}
          </Card>
        </main>
      </div>

      <EmployeeDetailModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSaved={() => void loadEmployees()} />
    </div>
  );
}
