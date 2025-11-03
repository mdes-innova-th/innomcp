import { fetchWithCSRF } from "@/utils/csrf";
import { isClientWebView, openInExternalBrowser } from "@/utils/webViewDetection";

export async function handleThaiDLogin({ host, setThaidError, setIsThaidLoading }: {
  host: string;
  setThaidError: (msg: string) => void;
  setIsThaidLoading: (loading: boolean) => void;
}) {
  setIsThaidLoading(true);
  setThaidError("");

  try {
    document.cookie = "cct_thaid_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    const isWebView = isClientWebView();
    const response = await fetchWithCSRF(`${host}/api/user/login/thaid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isWebView }),
    });
    if (!response.ok) {
      setThaidError("ไม่สามารถเชื่อมต่อกับ ThaiD ได้ กรุณาลองใหม่อีกครั้ง");
      return;
    }
    const data = await response.json();
    if (data.authUrl) {
      if (isWebView) {
        openInExternalBrowser(data.authUrl);
      } else {
        window.location.href = data.authUrl;
      }
    } else {
      setThaidError("ไม่สามารถเล็อกอินด้วย ThaiD ได้");
    }
  } catch {
    setThaidError("เกิดข้อผิดพลาดในการเชื่อมต่อกับ ThaiD");
  } finally {
    setTimeout(() => setIsThaidLoading(false), 2000);
  }
}
