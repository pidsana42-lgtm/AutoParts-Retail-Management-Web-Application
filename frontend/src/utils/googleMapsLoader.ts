// โหลด Google Maps JavaScript SDK (พร้อม Places library สำหรับช่องค้นหาที่อยู่) แบบครั้งเดียว
// ใช้ร่วมกันได้จากหลาย component (เช่น เปิดฟอร์มเพิ่ม/แก้ไขซัพพลายเออร์คนละที่ ก็ไม่ต้องโหลด script ซ้ำ)
let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (loadPromise) return loadPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey) {
    return Promise.reject(new Error("ไม่ได้ตั้งค่า VITE_GOOGLE_MAPS_API_KEY ใน .env"));
  }

  // เผื่อ script ถูกโหลดไปแล้วจากที่อื่น (เช่น ตอน hot reload ระหว่าง dev) ไม่ต้องโหลดซ้ำ
  if (typeof window !== "undefined" && window.google?.maps?.places) {
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    // หมายเหตุ: ตั้งใจไม่ใส่ &loading=async เพราะโค้ดในโปรเจกต์นี้อ้าง google.maps.Map/Marker/places.Autocomplete
    // แบบ global ตรงๆ ทันทีหลัง script โหลดเสร็จ — ถ้าใส่ loading=async ตัว namespace google.maps จะยังไม่ถูก
    // เติมครบตอน onload ทำงาน (ต้องใช้ google.maps.importLibrary() แทนถึงจะปลอดภัย) ไม่ใส่แบบนี้จึงรับประกันว่า
    // พอ onload ทำงาน google.maps.* พร้อมใช้ทันทีแบบเดิม (synchronous bootstrap loader)
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // ให้ลองโหลดใหม่ได้ถ้าครั้งนี้ล้มเหลว (เช่น เน็ตหลุดตอนโหลด)
      reject(new Error("โหลด Google Maps SDK ไม่สำเร็จ"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
