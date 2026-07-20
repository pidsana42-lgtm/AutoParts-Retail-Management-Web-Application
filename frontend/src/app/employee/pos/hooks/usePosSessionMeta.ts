import { useState, useEffect } from "react";
import { useAuth } from "../../../../contexts/AuthContexts";

export function usePosSessionMeta() {
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  
  // สมมติชื่อพนักงาน (ในอนาคตเปลี่ยนเป็นดึงจาก useAuth() หรือ localStorage ได้เลย)
    const { user } = useAuth();
    const currentStaff = user?.name || "ไม่ทราบชื่อ";

  useEffect(() => {
    // ให้เวลาเดินวินาทีต่อวินาที
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format วันที่ภาษาไทย
  const formatDate = currentDateTime.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format เวลาภาษาไทย
  const formatTime = currentDateTime.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return {
    formatDate,
    formatTime,
    currentStaff,
  };
}