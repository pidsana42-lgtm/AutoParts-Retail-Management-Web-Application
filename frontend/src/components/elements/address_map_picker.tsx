import { useEffect, useRef, useState } from "react";
import Input from "./input";
import { cn } from "../../utils/component";
import { loadGoogleMaps } from "../../utils/googleMapsLoader";

interface AddressMapPickerProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  containerClassName?: string;
  error?: string;
}

// ศูนย์กลางแผนที่เริ่มต้น (กรุงเทพฯ) ใช้ตอนยังไม่มีที่อยู่เดิม/ยังหาตำแหน่งไม่เจอ
const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 };

// ช่องกรอกที่อยู่แบบมีแผนที่ Google Maps ให้เลือกตำแหน่งจริง — พิมพ์ค้นหา (Places Autocomplete),
// คลิกบนแผนที่ หรือลากหมุดปัก ก็ได้ทั้งหมด แล้วอัปเดตข้อความที่อยู่กลับไปที่ฟอร์มให้อัตโนมัติ
export default function AddressMapPicker({
  label,
  required,
  value,
  onChange,
  placeholder,
  containerClassName,
  error,
}: AddressMapPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  // เก็บที่อยู่ล่าสุดไว้ใน ref ด้วย กัน closure เก่าของ event listener (สร้างครั้งเดียวตอน mount) อ้าง value ตัวเก่าค้าง
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // โหลด Google Maps SDK ครั้งเดียวตอน mount
  useEffect(() => {
    let alive = true;
    loadGoogleMaps()
      .then(() => {
        if (alive) setLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load Google Maps:", err);
        if (alive) setLoadError(err?.message || "โหลดแผนที่ไม่สำเร็จ");
      });
    return () => {
      alive = false;
    };
  }, []);

  // สร้างแผนที่ + หมุด + ช่องค้นหา ครั้งเดียวหลัง SDK โหลดเสร็จ
  useEffect(() => {
    if (!loaded || !mapContainerRef.current || !inputRef.current || mapRef.current) return;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;

    const marker = new google.maps.Marker({
      map,
      position: DEFAULT_CENTER,
      draggable: true,
    });
    markerRef.current = marker;

    const geocoder = new google.maps.Geocoder();
    geocoderRef.current = geocoder;

    // ลากหมุดไปวางตำแหน่งใหม่ -> หาที่อยู่ตรงนั้นย้อนกลับ (reverse geocode) แล้วอัปเดตฟอร์ม
    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (!pos) return;
      geocoder.geocode({ location: pos }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          onChangeRef.current(results[0].formatted_address);
        }
      });
    });

    // คลิกจุดไหนบนแผนที่ -> ย้ายหมุดไปตรงนั้นแล้วหาที่อยู่ให้เลย
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      marker.setPosition(e.latLng);
      map.panTo(e.latLng);
      geocoder.geocode({ location: e.latLng }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          onChangeRef.current(results[0].formatted_address);
        }
      });
    });

    // ช่องค้นหาที่อยู่แบบพิมพ์แล้วมี suggestion ให้เลือก (Places Autocomplete) — จำกัดผลลัพธ์เฉพาะในไทย
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry"],
      componentRestrictions: { country: "th" },
    });
    autocomplete.bindTo("bounds", map);
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;
      map.panTo(place.geometry.location);
      map.setZoom(16);
      marker.setPosition(place.geometry.location);
      onChangeRef.current(place.formatted_address || inputRef.current?.value || "");
    });

    // ถ้ามีที่อยู่เดิมอยู่แล้ว (ตอนเปิดฟอร์มแก้ไข) ลองหาตำแหน่งบนแผนที่ให้ตรงกันไว้ก่อนเลย
    if (value) {
      geocoder.geocode({ address: value }, (results, status) => {
        if (status === "OK" && results && results[0]?.geometry?.location) {
          map.panTo(results[0].geometry.location);
          map.setZoom(16);
          marker.setPosition(results[0].geometry.location);
        }
      });
    }
    // ตั้งใจให้ effect นี้รันแค่ครั้งเดียวตอน loaded เปลี่ยนเป็น true (สร้างแผนที่ครั้งเดียว ไม่สร้างซ้ำทุกครั้งที่ value เปลี่ยน)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      <Input
        ref={inputRef}
        label={label}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // กัน Enter (ตอนเลือก suggestion จาก Places Autocomplete) ไม่ให้ไป trigger การ submit ฟอร์มแบบ native ของ browser
        // (บั๊กที่รู้จักกันดี: กด Enter เลือกที่อยู่ในช่องที่อยู่ใน <form> เบราว์เซอร์จะเข้าใจว่ากดส่งฟอร์มไปด้วย หน้าเลย reload)
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder={loaded ? placeholder || "พิมพ์ค้นหาที่อยู่..." : loadError ? placeholder : "กำลังโหลดแผนที่..."}
        disabled={!loaded && !loadError}
        error={error}
      />

      {loadError ? (
        <p className="text-xs text-amber-600">
          โหลดแผนที่ไม่สำเร็จ ({loadError}) — กรอกที่อยู่เป็นข้อความในช่องด้านบนแทนได้ตามปกติ
        </p>
      ) : (
        <>
          <div
            ref={mapContainerRef}
            className="h-64 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50"
          />
          <p className="text-xs text-slate-400">พิมพ์ค้นหาในช่องด้านบน, คลิกบนแผนที่ หรือลากหมุดปัก เพื่อเลือกตำแหน่งที่อยู่</p>
        </>
      )}
    </div>
  );
}
