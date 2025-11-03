"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/common/ui/button";
import { Input } from "@/app/components/common/ui/input";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    userData: User | (Omit<User, "user_id"> & { password: string })
  ) => void;
  user?: User | null;
  isEditing: boolean;
}

export interface User {
  user_id: number;
  username: string;
  user_dispname: string;
  user_email: string;
  user_phone?: string;
  user_active: string;
  userrole_id: string;
}

// Role interface
interface Role {
  userrole_id: string;
  userrole_name: string;
}

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  user,
  isEditing,
}: UserModalProps) {
  const [userData, setUserData] = useState({
    username: "",
    user_dispname: "",
    user_email: "",
    user_phone: "",
    password: "",
    user_active: "1",
    userrole_id: "1",
  });
  const [roles, setRoles] = useState<Role[]>([
    { userrole_id: "1", userrole_name: "ผู้ใช้งานทั่วไป" },
    { userrole_id: "2", userrole_name: "ผู้ดูแลระบบ" },
  ]);

  // Fetch roles from API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch("/api/user/roles");
        if (response.ok) {
          const data = await response.json();
          if (data.roles && Array.isArray(data.roles)) {
            setRoles(data.roles);
          }
        } else {
          console.error("Failed to fetch roles");
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
      }
    };

    fetchRoles();
  }, []);

  // Load user data when editing an existing user
  useEffect(() => {
    if (user && isEditing) {
      setUserData({
        username: user.username,
        user_dispname: user.user_dispname,
        user_email: user.user_email,
        user_phone: user.user_phone || "",
        password: "",
        user_active: user.user_active,
        userrole_id: user.userrole_id,
      });
    } else {
      // Reset form for new user
      setUserData({
        username: "",
        user_dispname: "",
        user_email: "",
        user_phone: "",
        password: "",
        user_active: "1",
        userrole_id: "1",
      });
    }
  }, [user, isEditing]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setUserData({
      ...userData,
      [name]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // For existing users being edited, include the user ID
    if (user && isEditing) {
      onSave({ ...userData, user_id: user.user_id });
    } else {
      onSave(userData);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md my-4 max-h-screen overflow-y-auto">
        {" "}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? "แก้ไขข้อมูลผู้ใช้งาน" : "เพิ่มผู้ใช้งานใหม่"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors duration-200"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-group">
            <label className="block text-base font-bold text-gray-800 mb-3">
              ชื่อผู้ใช้{" "}
              {!isEditing && <span className="text-red-500 font-bold">*</span>}
            </label>
            <Input
              type="text"
              name="username"
              value={userData.username}
              onChange={handleChange}
              disabled={isEditing}
              required
              placeholder="ชื่อผู้ใช้สำหรับเข้าสู่ระบบ"
              className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none transition-colors duration-200 ${
                isEditing
                  ? "bg-gray-100 cursor-not-allowed text-gray-600"
                  : "bg-white text-gray-900"
              }`}
            />
            {isEditing && (
              <p className="text-sm text-gray-600 mt-2 font-medium">
                ชื่อผู้ใช้ไม่สามารถแก้ไขได้หลังจากสร้างแล้ว
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="block text-base font-bold text-gray-800 mb-3">
              ชื่อ{" "}
              <span className="text-red-500 font-bold">*</span>
            </label>
            <Input
              type="text"
              name="user_dispname"
              value={userData.user_dispname}
              onChange={handleChange}
              required
              placeholder="ชื่อที่จะแสดงในระบบ"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none bg-white text-gray-900 transition-colors duration-200"
            />
          </div>

          <div className="form-group">
            <label className="block text-base font-bold text-gray-800 mb-3">
              อีเมล
            </label>
            <Input
              type="email"
              name="user_email"
              value={userData.user_email}
              onChange={handleChange}
              placeholder="อีเมลผู้ใช้"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none bg-white text-gray-900 transition-colors duration-200"
            />
          </div>

          <div className="form-group">
            <label className="block text-base font-bold text-gray-800 mb-3">
              หมายเลขโทรศัพท์
            </label>
            <Input
              type="text"
              name="user_phone"
              value={userData.user_phone}
              onChange={handleChange}
              placeholder="หมายเลขโทรศัพท์"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none bg-white text-gray-900 transition-colors duration-200"
              maxLength={30}
            />
          </div>

          <div className="form-group">
            <label className="block text-base font-bold text-gray-800 mb-3">
              รหัสผ่าน{" "}
              {!isEditing && <span className="text-red-500 font-bold">*</span>}
            </label>
            <Input
              type="password"
              name="password"
              value={userData.password}
              onChange={handleChange}
              required={!isEditing}
              placeholder={
                isEditing
                  ? "เว้นว่างถ้าไม่ต้องการเปลี่ยนรหัสผ่าน"
                  : "รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none bg-white text-gray-900 transition-colors duration-200"
              minLength={8}
            />
            {isEditing && (
              <p className="text-sm text-gray-600 mt-2 font-medium">
                เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="block text-base font-bold text-gray-800 mb-3">
              สถานะการใช้งาน
            </label>
            <select
              name="user_active"
              value={userData.user_active}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none bg-white text-gray-900 transition-colors duration-200"
            >
              <option value="1">✅ ใช้งานได้</option>
              <option value="0">❌ ปิดการใช้งาน</option>
            </select>
          </div>

          <div className="form-group">
            <label className="block text-base font-bold text-gray-800 mb-3">
              ระดับสิทธิ์ผู้ใช้
            </label>
            <select
              name="userrole_id"
              value={userData.userrole_id}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none bg-white text-gray-900 transition-colors duration-200"
            >
              {roles.map((role) => (
                <option key={role.userrole_id} value={role.userrole_id}>
                  {role.userrole_id === "0"
                    ? "🔐"
                    : role.userrole_id === "1"
                    ? "👤"
                    : "👑"}{" "}
                  {role.userrole_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="px-6 py-3 text-base font-semibold transition-colors duration-200"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="px-6 py-3 text-base font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
            >
              {isEditing ? "💾 บันทึกการเปลี่ยนแปลง" : "➕ เพิ่มผู้ใช้"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
