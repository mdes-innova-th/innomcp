import { fetchWithCSRF } from "@/utils/csrf";

export async function handleFormLogin({ username, password, host, checkAuth, setFormError, setIsFormLoading }: {
  username: string;
  password: string;
  host: string;
  checkAuth: () => Promise<void>;
  setFormError: (msg: string) => void;
  setIsFormLoading: (loading: boolean) => void;
}) {
  setFormError("");
  setIsFormLoading(true);

  if (!username) {
    setFormError("กรุณากรอกอีเมลหรือ Username");
    setIsFormLoading(false);
    return;
  }
  if (!password) {
    setFormError("กรุณากรอกรหัสผ่าน");
    setIsFormLoading(false);
    return;
  }

  try {
    const response = await fetchWithCSRF(`${host}/api/user/login/form`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.status === 401) {
      setFormError("อีเมล หรือ Username หรือรหัสผ่านไม่ถูกต้อง");
    } else if (!response.ok) {
      setFormError("ไม่สามารถล็อกอินได้ขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง");
    } else {
      await checkAuth();
      console.log("[Login] Login successful!");
    }
  } catch (err) {
    console.error("Login error:", err);
    setFormError("ไม่สามารถล็อกอินได้ขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง");
  } finally {
    setIsFormLoading(false);
  }
}
