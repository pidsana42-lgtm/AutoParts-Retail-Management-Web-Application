import { useState, useEffect } from "react";
import { posApiService } from "../service/http/pos/pos_service";

export interface EmployeeOption {
  label: string;
  value: string;
}

export function useEmployeeOptions() {
  const [employeeList, setEmployeeList] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    posApiService
      .getEmployees()
      .then((res: any[]) => {
        if (!isMounted || !Array.isArray(res)) return;

        const options: EmployeeOption[] = res.map((emp: any) => {
          const fullName = [emp.first_name, emp.last_name].filter(Boolean).join(" ");
          const displayName = fullName || emp.name || emp.username || `พนักงาน #${emp.id}`;

          return {
            label: displayName,
            value: String(emp.id),
          };
        });

        setEmployeeList(options);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load employee list:", err);
        setError("ไม่สามารถดึงรายชื่อพนักงานได้");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { 
    employeeList, 
    isEmployeesLoading: isLoading,
    employeeError: error 
  };
}