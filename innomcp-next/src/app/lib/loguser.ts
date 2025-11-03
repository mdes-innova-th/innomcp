import { withDbConnection } from "./db";

/**
 * บันทึก log ผู้ใช้ลงฐานข้อมูล userlog
 * @param user_id หมายเลขผู้ใช้
 * @param activity ข้อความกิจกรรม
 * @param ipaddress IP Address ของผู้ใช้
 * @param userAgent User Agent ของผู้ใช้
 */
export async function logUserActivity({
  user_id,
  activity,
  ipaddress,
  userAgent,
  request,
}: {
  user_id: number;
  activity: string;
  ipaddress?: string | null;
  userAgent?: string | null;
  request?: Request;
}): Promise<void> {
  // ถ้าไม่ได้ป้อน ipaddress หรือ userAgent ให้ดึงจาก request (ถ้ามี)
  let finalIp = ipaddress;
  let finalUA = userAgent;
  if ((!finalIp || !finalUA) && request) {
    if (!finalIp) {
      finalIp =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        null;
    }
    if (!finalUA) {
      finalUA = request.headers.get("user-agent") || null;
    }
  }
  await withDbConnection(async (conn) => {
    const activityWithUA = finalUA ? `${activity} [UA: ${finalUA}]` : activity;
    const result = await conn.execute(
      `INSERT INTO userlog (ipaddress, activity, user_id) VALUES (?, ?, ?)`,
      [finalIp || null, activityWithUA, user_id]
    );

    if (result && Array.isArray(result) && result.length > 0) {
      console.log(
        `[logUserActivity] Logged activity UserID:${user_id} Activity:"${activityWithUA}" IP:${finalIp}`
      );
    } else {
      console.error(
        `[logUserActivity] === Failed === to log activity UserID:${user_id} Activity:"${activityWithUA}" IP:${finalIp}`
      );
    }
  });
}
