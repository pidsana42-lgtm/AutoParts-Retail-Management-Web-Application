import { Eye } from "lucide-react";
import Badge from "../../../../components/elements/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/elements/table";
import { formatDate } from "../../../../utils/formatdate";
import type { CreatedEmployee } from "../../../../interface/employee/employee_registration";
import { resolveAssetUrl } from "../../../../service/http/companysetting/company_service";

interface EmployeeTableProps {
  employees: CreatedEmployee[];
  onView: (employee: CreatedEmployee) => void;
}

export default function EmployeeTable({ employees, onView }: EmployeeTableProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table className="w-full! min-w-0! table-fixed text-left">
          <TableHeader className="text-xs text-gray-600">
            <TableRow>
              <TableHead className="w-[22%] px-6 py-3">พนักงาน</TableHead>
              <TableHead className="w-[16%] px-4 py-3">ชื่อผู้ใช้</TableHead>
              <TableHead className="w-[14%] px-4 py-3">สิทธิ์</TableHead>
              <TableHead className="w-[18%] px-4 py-3">บัญชีธนาคาร</TableHead>
              <TableHead className="w-[10%] px-4 py-3 text-center">LINE</TableHead>
              <TableHead className="w-[12%] px-4 py-3">วันที่ลงทะเบียน</TableHead>
              <TableHead className="w-[8%] whitespace-nowrap px-3 py-3 text-center">
                <span className="hidden lg:inline">ดูข้อมูล</span>
                <Eye size={15} className="mx-auto lg:hidden" aria-hidden="true" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id} onClick={() => onView(employee)} tabIndex={0} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onView(employee);
              }}>
                <TableCell className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {employee.profile_image_path ? (
                      <img src={resolveAssetUrl(employee.profile_image_path)} alt="" className="h-9 w-9 shrink-0 rounded-none object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-red-50 text-sm font-semibold text-[#B70011]">
                        {employee.first_name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <p className="truncate font-medium black">{employee.first_name} {employee.last_name}</p>
                  </div>
                </TableCell>
                <TableCell className="truncate px-4 py-4 font-medium">{employee.username}</TableCell>
                <TableCell className="px-4 py-4">
                  <Badge variant={employee.role === "Manager" ? "primary" : "neutral"} size="auto" className="px-2.5 py-1 text-xs">
                    {employee.role === "Manager" ? "ผู้จัดการ" : "พนักงาน"}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-4">
                  <p className="truncate">{employee.bank_name || "-"}</p>
                  <p className="mt-0.5 text-xs tracking-wider text-gray-400">{employee.account_masked || "-"}</p>
                </TableCell>
                <TableCell className="px-4 py-4 text-center">
                  <Badge variant={employee.line_connected ? "success" : "neutral"} size="auto" className="px-2.5 py-1 text-xs">
                    {employee.line_connected ? "เชื่อมแล้ว" : "ยังไม่เชื่อม"}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-4">{formatDate(employee.created_at)}</TableCell>
                <TableCell className="px-3 py-4 text-center">
                  <button
                    type="button"
                    aria-label={`ดูข้อมูล ${employee.first_name} ${employee.last_name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onView(employee);
                    }}
                    className="inline-flex whitespace-nowrap cursor-pointer items-center justify-center gap-1.5 text-sm font-medium text-[#B70011] transition-colors hover:text-[#E51C23] hover:underline"
                  >
                    <Eye size={15} />
                    <span className="hidden lg:inline">ดูข้อมูล</span>
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y divide-gray-100 md:hidden">
        {employees.map((employee) => (
          <div key={employee.id} role="button" tabIndex={0} onClick={() => onView(employee)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onView(employee);
          }} className="cursor-pointer space-y-4 p-5 transition-colors hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {employee.profile_image_path ? (
                  <img src={resolveAssetUrl(employee.profile_image_path)} alt="" className="h-10 w-10 shrink-0 rounded-none object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-red-50 text-sm font-semibold text-[#B70011]">
                    {employee.first_name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                <p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>
                <p className="mt-0.5 text-xs text-gray-500">@{employee.username}</p>
                </div>
              </div>
              <Badge variant={employee.role === "Manager" ? "primary" : "success"} size="auto" className="px-2.5 py-1 text-xs">
                {employee.role === "Manager" ? "ผู้จัดการ" : "พนักงาน"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-gray-400">ธนาคาร</p><p className="mt-1 tracking-wider text-gray-700">{employee.bank_name || "-"} · {employee.account_masked || "-"}</p></div>
              <div><p className="text-gray-400">วันที่ลงทะเบียน</p><p className="mt-1 text-gray-700">{formatDate(employee.created_at)}</p></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
