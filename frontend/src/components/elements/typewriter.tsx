import { useEffect, useRef, useState } from "react";
import { cn } from "../../utils/component";

interface TypewriterProps {
  /** แต่ละสตริงในอาเรย์คือหนึ่งบรรทัด จะพิมพ์เรียงกันไปทีละบรรทัดโดยอัตโนมัติ */
  lines: string[];
  /** ความเร็วในการพิมพ์ (ms ต่อ 1 ตัวอักษร) */
  speed?: number;
  /** หน่วงเวลาก่อนเริ่มพิมพ์ตัวแรก (ms) */
  startDelay?: number;
  /** หน่วงเวลาระหว่างขึ้นบรรทัดใหม่ (ms) */
  lineDelay?: number;
  /** แสดงเคอร์เซอร์กระพริบท้ายข้อความหรือไม่ */
  cursor?: boolean;
  /** เรียกเมื่อพิมพ์ครบทุกบรรทัดแล้ว (ใช้ต่อ animation อื่นๆ ให้เริ่มตามหลังได้) */
  onDone?: () => void;
  className?: string;
}

// เอฟเฟกต์พิมพ์ทีละตัวอักษร — แยกทีละ "โคดพอยต์" (ไม่ใช่ทีละไบต์) กันสระ/วรรณยุกต์ไทยที่เป็นอักขระประกอบ
// (เช่น ่, ้, ั, ำ) หลุดเพี้ยนระหว่างพิมพ์
export default function Typewriter({
  lines,
  speed = 55,
  startDelay = 300,
  lineDelay = 150,
  cursor = true,
  onDone,
  className,
}: TypewriterProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const linesKey = lines.join("\n");

  // รีเซ็ตใหม่ทุกครั้งที่ข้อความที่จะพิมพ์เปลี่ยน (เช่น เปลี่ยนภาษา)
  useEffect(() => {
    setLineIndex(0);
    setCharIndex(0);
    setDone(false);
  }, [linesKey]);

  useEffect(() => {
    if (done) return;

    const currentLine = lines[lineIndex] ?? "";
    const chars = Array.from(currentLine);

    if (charIndex < chars.length) {
      const delay = lineIndex === 0 && charIndex === 0 ? startDelay : speed;
      const timer = setTimeout(() => setCharIndex((c) => c + 1), delay);
      return () => clearTimeout(timer);
    }

    if (lineIndex < lines.length - 1) {
      const timer = setTimeout(() => {
        setLineIndex((l) => l + 1);
        setCharIndex(0);
      }, lineDelay);
      return () => clearTimeout(timer);
    }

    // พิมพ์ครบทุกบรรทัดแล้ว — เอาเคอร์เซอร์ออกหลังจากนี้
    setDone(true);
    onDoneRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIndex, lineIndex, linesKey, speed, startDelay, lineDelay, done]);

  const fullText = lines.join(" ");

  return (
    <span className={cn("inline-block", className)}>
      {/* ข้อความเต็มสำหรับ screen reader (ตัวที่เห็นเป็น animation ซ่อนจากการอ่านจอเพื่อกันอ่านซ้ำ/อ่านครึ่งคำ) */}
      <span className="sr-only">{fullText}</span>

      <span aria-hidden="true">
        {lines.slice(0, lineIndex).map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
        <span className="block">
          {Array.from(lines[lineIndex] ?? "").slice(0, charIndex).join("")}
          {cursor && !done && (
            <span className="typewriter-caret relative ml-0.5 inline-block h-[1em] w-0.75 bg-current align-text-bottom" />
          )}
        </span>
      </span>
    </span>
  );
}
