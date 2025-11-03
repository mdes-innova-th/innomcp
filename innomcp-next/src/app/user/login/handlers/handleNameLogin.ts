import { fetchWithCSRF } from "@/utils/csrf";

export async function handleNameLogin({
  displayName,
  birthDate,
  host,
  checkAuth,
  setNameFormError,
  setIsNameFormLoading,
}: {
  displayName: string;
  birthDate: string;
  host: string;
  checkAuth: () => Promise<void>;
  setNameFormError: (msg: string) => void;
  setIsNameFormLoading: (loading: boolean) => void;
}) {
  setNameFormError("");
  setIsNameFormLoading(true);

  const trimmedDisplayName = displayName.trim();

  if (!trimmedDisplayName || trimmedDisplayName.length < 2) {
    setNameFormError("กรุณากรอกชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร");
    setIsNameFormLoading(false);
    return;
  }
  if (trimmedDisplayName.length > 100) {
    setNameFormError("ชื่อ-นามสกุลต้องไม่เกิน 100 ตัวอักษร");
    setIsNameFormLoading(false);
    return;
  }
  if (!birthDate) {
    setNameFormError("กรุณาระบุวันเดือนปีเกิด");
    setIsNameFormLoading(false);
    return;
  }

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  if (birth > today) {
    setNameFormError("วันเกิดไม่สามารถเป็นวันที่ในอนาคตได้");
    setIsNameFormLoading(false);
    return;
  }
  if (age < 18) {
    setNameFormError("ผู้ใช้ระบบต้องมีอายุอย่างน้อย 18 ปี");
    setIsNameFormLoading(false);
    return;
  }
  if (age > 120) {
    setNameFormError("อายุไม่สามารถเกิน 120 ปี");
    setIsNameFormLoading(false);
    return;
  }

  try {
    const response = await fetchWithCSRF(`${host}/api/user/login/name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: trimmedDisplayName, birthDate }),
    });

    if (response.status === 401) {
      setNameFormError("ชื่อ-นามสกุล หรือวันเกิดไม่ถูกต้อง");
    } else if (!response.ok) {
      setNameFormError(
        "ไม่สามารถล็อกอินได้ขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง"
      );
    } else {
      await checkAuth();
      console.log("[Login] Login successful!");
    }
  } catch (err) {
    console.error("Login error:", err);
    setNameFormError("ไม่สามารถล็อกอินได้ขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง");
  } finally {
    setIsNameFormLoading(false);
  }
}
