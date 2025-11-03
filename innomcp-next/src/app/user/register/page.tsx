"use client";

// import { useEffect } from "react";
import { useRouter } from "next/navigation";

// import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
// import { useAuth } from "@/app/context/AuthContext";
// import { useCSRFToken } from "@/utils/useCSRFToken";
// import { fetchWithCSRF } from "@/utils/csrf";

function RegisterPage() {
  // ปิดหน้านี้ไม่ใช้ redirectไปที่หน้าแรก /
  const router = useRouter();
  router.replace("/");
  return null;

  // const { isLoggedIn, isAuthLoading } = useAuth();
  // const [formData, setFormData] = useState({
  //   username: "",
  //   user_email: "",
  //   user_phone: "",
  //   user_dispname: "",
  //   password: "",
  //   confirmPassword: "",
  // });
  // const [error, setError] = useState("");
  // const [success, setSuccess] = useState("");
  // const { csrfToken } = useCSRFToken();

  // const router = useRouter();

  // // redirect ถ้า login แล้ว
  // useEffect(() => {
  //   if (isLoggedIn) {
  //     router.replace("/");
  //   }
  // }, [isLoggedIn, router]);

  // const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   setFormData({ ...formData, [e.target.name]: e.target.value.trim() });
  // };

  // const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value.toLowerCase().trim(); // Convert to lowercase and trim
  //   // Allow only English letters, numbers, _ and - and .
  //   const usernameRegex = /^[a-zA-Z0-9_.-]*$/;
  //   if (usernameRegex.test(value)) {
  //     setFormData({ ...formData, username: value });
  //   }
  // };

  // const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value.trim(); // Trim input
  //   const emailRegex = /^[a-zA-Z0-9@._-]*$/;
  //   if (emailRegex.test(value)) {
  //     setFormData({ ...formData, user_email: value });
  //   }
  // };

  // const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   // อนุญาตเฉพาะตัวเลขและขีดกลาง
  //   const value = e.target.value.replace(/[^0-9-]/g, "");
  //   setFormData({ ...formData, user_phone: value });
  // };

  // const handleRegister = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setError("");
  //   setSuccess("");
  //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  //   const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  //   if (!emailRegex.test(formData.user_email)) {
  //     setError("รูปแบบอีเมลไม่ถูกต้อง");
  //     return;
  //   }
  //   if (!usernameRegex.test(formData.username)) {
  //     setError(
  //       "ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ, ตัวเลข, _ , - และ . เท่านั้น"
  //     );
  //     return;
  //   }
  //   if (
  //     !formData.username ||
  //     !formData.user_email ||
  //     !formData.user_phone ||
  //     !formData.user_dispname ||
  //     !formData.password ||
  //     !formData.confirmPassword
  //   ) {
  //     setError("กรุณาใส่ข้อมูลให้ครบถ้วน");
  //     return;
  //   }
  //   if (formData.password !== formData.confirmPassword) {
  //     setError("รหัสผ่านไม่ตรงกัน");
  //     return;
  //   }
  //   if (!csrfToken) {
  //     setError("เกิดข้อผิดพลาดด้านความปลอดภัย กรุณาลองใหม่อีกครั้ง");
  //     return;
  //   }
  //   try {
  //     const response = await fetchWithCSRF("/api/user/register", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(formData),
  //     });
  //     const data = await response.json();
  //     if (!response.ok) {
  //       setError(data.message || "การลงทะเบียนไม่สำเร็จ");
  //       return;
  //     }
  //     setSuccess("ลงทะเบียนสำเร็จ!");
  //     setTimeout(() => router.push("/"), 2000);
  //   } catch (err) {
  //     console.error("catch-Error:", err);
  //     setError("การลงทะเบียนไม่สำเร็จ");
  //   }
  // };

  // // แสดง LoadingSpinner ระหว่างรอเช็ค authen
  // if (isAuthLoading) {
  //   return (
  //     <div className="flex items-center justify-center h-screen bg-gray-300 dark:bg-gray-600">
  //       <LoadingSpinner className="text-gray-700 dark:text-white" />
  //     </div>
  //   );
  // }

  // // ถ้า login แล้ว ให้แสดง LoadingSpinner ขณะรอ redirect
  // if (isLoggedIn) {
  //   return (
  //     <div className="flex items-center justify-center h-screen bg-gray-300 dark:bg-gray-600">
  //       <LoadingSpinner className="text-gray-700 dark:text-white" />
  //     </div>
  //   );
  // }

  // return (
  //   <div className="flex-1 flex items-center justify-center px-3 bg-gray-300 dark:bg-gray-600">
  //     <form
  //       onSubmit={handleRegister}
  //       className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md mx-auto relative m-5"
  //     >
  //       <button
  //         onClick={() => router.push("/user/login")}
  //         className="absolute top-3 right-3 text-blue-500 rounded px-2 py-1 text-sm hover:outline-none focus:outline-none border border-blue-300 hover:bg-blue-300 hover:text-white transition duration-300"
  //       >
  //         <span className="hidden sm:inline">ฉันมีบัญชีอยู่แล้ว</span>
  //         <span className="sm:hidden">เข้าสู่ระบบ</span>
  //       </button>
  //       <h2 className="text-xl sm:text-2xl text-gray-700 font-bold mb-4 pr-6 text-center">
  //         สมัครสมาชิก
  //       </h2>{" "}
  //       <div className="mb-4">
  //         <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
  //           ชื่อผู้ใช้
  //         </label>
  //         <input
  //           type="text"
  //           name="username"
  //           value={formData.username}
  //           onChange={handleUsernameChange}
  //           className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
  //           maxLength={45}
  //           required
  //         />
  //       </div>
  //       <div className="mb-4">
  //         <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
  //           ชื่อ
  //         </label>
  //         <input
  //           type="text"
  //           name="user_dispname"
  //           value={formData.user_dispname}
  //           onChange={handleChange}
  //           className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
  //           maxLength={45}
  //           required
  //         />
  //       </div>
  //       <div className="mb-4">
  //         <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
  //           อีเมล
  //         </label>
  //         <input
  //           type="email"
  //           name="user_email"
  //           value={formData.user_email}
  //           onChange={handleEmailChange}
  //           className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
  //           maxLength={200}
  //           required
  //         />
  //       </div>
  //       <div className="mb-4">
  //         <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
  //           หมายเลขโทรศัพท์
  //         </label>
  //         <input
  //           type="text"
  //           name="user_phone"
  //           value={formData.user_phone}
  //           onChange={handlePhoneChange}
  //           className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
  //           maxLength={30}
  //           required
  //         />
  //       </div>
  //       <div className="mb-4">
  //         <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
  //           รหัสผ่าน
  //         </label>
  //         <input
  //           type="password"
  //           name="password"
  //           value={formData.password}
  //           onChange={handleChange}
  //           className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
  //           required
  //         />
  //       </div>
  //       <div className="mb-4">
  //         <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
  //           ยืนยันรหัสผ่าน
  //         </label>
  //         <input
  //           type="password"
  //           name="confirmPassword"
  //           value={formData.confirmPassword}
  //           onChange={handleChange}
  //           className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
  //           required
  //         />
  //       </div>{" "}
  //       {error && <p className="text-red-500 mt-2 mb-3 text-sm">{error}</p>}
  //       {success && (
  //         <p className="text-green-500 mt-2 mb-3 text-sm">{success}</p>
  //       )}
  //       <button
  //         type="submit"
  //         className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 text-base font-medium"
  //       >
  //         ลงทะเบียน
  //       </button>
  //     </form>
  //   </div>
  // );
}

export default RegisterPage;
