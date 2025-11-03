// ตรวจสอบรูปแบบ URL
export function validateUrl(url: string): boolean {
  // Trim ช่องว่างหน้า-หลัง
  url = url.trim();
  // ห้ามมีช่องว่างใน url
  if (/\s/.test(url)) return false;
  // ต้องขึ้นต้น http:// หรือ https:// เท่านั้น
  if (!/^https?:\/\//i.test(url)) return false;
  // ห้ามมีอักขระพิเศษที่ไม่อนุญาตใน url
  // เช่น * ? < > " ' ` | \ ^ { } [ ] ( ) ;
  // ห้ามมีอักขระพิเศษที่ไม่อนุญาตใน url
  // เช่น * < > " ' ` | \ ^ { } [ ] ( ) ; (อนุญาต ? สำหรับ query string)
  // ห้ามมีอักขระที่ผิดมาตรฐาน URL (RFC3986)
  // อนุญาต reserved/unreserved: - _ . ~ / : ? # [ ] @ ! $ & ' ( ) * + , ; = %
  // ห้าม: ช่องว่าง, ", <, >, ^, {, }, |, \, `
  if (/[\s"<>^{}|\\`]/.test(url)) return false;
  try {
    const u = new URL(url);
    // protocol ต้องเป็น http หรือ https
    if (!(u.protocol === "http:" || u.protocol === "https:")) return false;
    // host ต้องมี . (dot) และไม่ใช่ localhost หรือ 127.0.0.1
    if (
      !u.hostname.includes(".") ||
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1"
    )
      return false;
    // path/query/fragment ห้ามขึ้นต้นด้วยช่องว่าง
    if (
      (u.pathname && /^\s/.test(u.pathname)) ||
      (u.search && /^\s/.test(u.search)) ||
      (u.hash && /^\s/.test(u.hash))
    )
      return false;
    // host ต้องไม่มีช่องว่าง
    if (/\s/.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
