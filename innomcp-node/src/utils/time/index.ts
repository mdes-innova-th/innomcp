/**
 * Time Module
 * จัดการเวลาท้องถิ่น (Asia/Bangkok)
 * คืนค่าทั้ง ISO timestamp และข้อความไทย
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

export interface TimeData {
  datetime: string; // ISO 8601 format
  timezone: string; // Timezone name with offset
  humanReadable: string; // Thai format: "วัน-เวลา"
  timestamp: number; // Unix timestamp
  components: {
    year: number;
    month: number;
    day: number;
    weekday: string;
    hour: number;
    minute: number;
    second: number;
  };
}

/**
 * ดึงเวลาปัจจุบันใน Asia/Bangkok timezone
 */
export function getCurrentTime(): TimeData {
  const now = new Date();

  // Format ภาษาไทย
  const thaiFormatter = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const humanReadable = thaiFormatter.format(now);

  // Components
  const components = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    weekday: new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      weekday: 'long',
    }).format(now),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  };

  return {
    datetime: now.toISOString(),
    timezone: 'Asia/Bangkok (UTC+7)',
    humanReadable,
    timestamp: now.getTime(),
    components,
  };
}

/**
 * แปลง timestamp เป็นภาษาไทย
 */
export function formatThaiTime(timestamp: string | number): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);

  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * คำนวณเวลาที่ผ่านไป (relative time)
 */
export function getRelativeTime(timestamp: string | number): string {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'เมื่อสักครู่';
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return formatThaiTime(timestamp);
}

/**
 * ตรวจสอบว่าอยู่ในช่วงเวลาทำงาน (9:00-18:00)
 */
export function isWorkingHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 9 && hour < 18;
}

/**
 * ดึงเวลาในรูปแบบที่กำหนด
 */
export function getFormattedTime(format: 'short' | 'long' | 'time-only' = 'long'): string {
  const now = new Date();

  switch (format) {
    case 'short':
      return new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

    case 'time-only':
      return new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);

    case 'long':
    default:
      return new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
  }
}

/**
 * หมายเหตุสำหรับการพัฒนาต่อ:
 * 
 * 1. รองรับ timezone อื่นๆ ตามที่ผู้ใช้ระบุ
 * 2. เพิ่มการคำนวณ sunrise/sunset time
 * 3. รองรับ Buddhist Era (พ.ศ.) และ Christian Era (ค.ศ.)
 * 4. เพิ่มการแปลงเวลาระหว่าง timezone
 */
