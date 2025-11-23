"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  FaPlus,
  FaTrash,
  FaKey,
  FaExclamationTriangle,
  FaCopy,
  FaPen,
  FaTimesCircle,
  FaCheck,
} from "react-icons/fa";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { Button } from "../components/common/ui/button";
import { fetchWithCSRF } from "@/utils/csrf";
import { useAuth } from "@/app/context/AuthContext";

interface ApiKey {
  apikey_id: number;
  apikey: string;
  status: "active" | "inactive" | "revoke";
  apikey_name: string;
  create: string;
  expire: string | null;
  update: string;
  rate_limit: number | null;
  allowed_origins: string | null;
  user_id: number | null;
}

export default function ApiKeyManagement() {
  const { isLoggedIn, isAuthLoading, userRoleId } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [allApiKeys, setAllApiKeys] = useState<ApiKey[]>([]); // Store all API keys for filtering
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive" | "revoke"
  >("all");
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [paginatedApiKeys, setPaginatedApiKeys] = useState<ApiKey[]>([]);
  const itemsPerPageOptions = [5, 10, 25, 50];

  // Form fields for API key
  const [apiKeyName, setApiKeyName] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [rateLimit, setRateLimit] = useState<number | "">("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [userId, setUserId] = useState<number | "">(""); // เพิ่ม state สำหรับ user_id
  const [formError, setFormError] = useState("");

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Apply filters based on search terms and status
  const applyFilters = useCallback(
    (apiKeysData: ApiKey[]) => {
      const filtered = apiKeysData.filter((apiKey) => {
        // Search filter
        const matchesSearch =
          searchName === "" ||
          apiKey.apikey_name.toLowerCase().includes(searchName.toLowerCase());

        // Status filter
        const matchesStatus =
          statusFilter === "all" || apiKey.status === statusFilter;

        return matchesSearch && matchesStatus;
      });

      // Calculate total pages when filter changes
      const calculatedTotalPages = Math.max(
        1,
        Math.ceil(filtered.length / itemsPerPage)
      );

      // Reset current page if we're beyond the new total pages
      if (currentPage > calculatedTotalPages) {
        setCurrentPage(1);
      }

      setTotalPages(calculatedTotalPages);
      setApiKeys(filtered);
    },
    [searchName, statusFilter, itemsPerPage, currentPage]
  );

  // Update paginated items whenever relevant state changes
  useEffect(() => {
    // Calculate paginated data
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedApiKeys(apiKeys.slice(startIndex, endIndex));
  }, [apiKeys, currentPage, itemsPerPage]);

  const fetchApiKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithCSRF("/api/apikey", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAllApiKeys(data.apiKeys || []); // Store all API keys for filtering
        applyFilters(data.apiKeys || []); // Apply current filters
      } else {
        console.error("Failed to fetch API keys:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setIsLoading(false);
    }
  }, [applyFilters]);

  // เรียก fetchApiKeys เมื่อ component mount เพื่อโหลดข้อมูล API Key ทันที
  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!apiKeyName.trim()) {
      setFormError("กรุณาระบุชื่อแอปพลิเคชันหรือเว็บไซต์");
      return;
    }

    try {
      const payload = {
        apikey_name: apiKeyName.trim(),
        ...(expireDate && { expire: new Date(expireDate).toISOString() }),
        ...(rateLimit !== "" && { rate_limit: Number(rateLimit) }),
        ...(allowedOrigins.trim() && {
          allowed_origins: allowedOrigins.trim(),
        }),
        ...(userId !== "" && { user_id: Number(userId) }), // เพิ่ม user_id ใน payload
      };

      const response = await fetchWithCSRF("/api/apikey", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setNewApiKey(data.apiKey);
        setShowAddModal(false);
        setShowSuccessModal(true);
        clearForm();
        fetchApiKeys();
      } else {
        const errorData = await response.json();
        setFormError(errorData.message || "เกิดข้อผิดพลาดในการสร้าง API Key");
      }
    } catch (error) {
      console.error("Error adding API key:", error);
      setFormError("เกิดข้อผิดพลาดในการสร้าง API Key");
    }
  };

  const handleRevokeApiKey = async (apiKeyId: number) => {
    if (
      !confirm(
        "คุณต้องการเพิกถอน API Key นี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"
      )
    ) {
      return;
    }

    try {
      const response = await fetchWithCSRF(`/api/apikey/revoke/${apiKeyId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        fetchApiKeys();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || "เกิดข้อผิดพลาดในการเพิกถอน API Key");
      }
    } catch (error) {
      console.error("Error revoking API key:", error);
      alert("เกิดข้อผิดพลาดในการเพิกถอน API Key");
    }
  };

  // Function for permanently deleting API key
  const handleDeleteApiKey = async (apiKeyId: number) => {
    if (
      !confirm(
        "คุณต้องการลบ API Key นี้อย่างถาวรหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"
      )
    ) {
      return;
    }

    try {
      const response = await fetchWithCSRF(`/api/apikey/delete/${apiKeyId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        fetchApiKeys();
      } else {
        alert("เกิดข้อผิดพลาดในการลบ API Key");
      }
    } catch (error) {
      console.error("Error deleting API key:", error);
      alert("เกิดข้อผิดพลาดในการลบ API Key");
    }
  };

  // Function for editing API key
  const handleEditApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!editingApiKey) return;
    if (!apiKeyName.trim()) {
      setFormError("กรุณาระบุชื่อแอปพลิเคชันหรือเว็บไซต์");
      return;
    }

    try {
      // Ensure rate_limit is correctly formatted
      const formattedRateLimit = rateLimit === "" ? null : Number(rateLimit);

      const payload = {
        apikey_name: apiKeyName.trim(),
        ...(expireDate && { expire: new Date(expireDate).toISOString() }),
        rate_limit: formattedRateLimit,
        allowed_origins: allowedOrigins.trim() || null,
        user_id: userId !== "" ? Number(userId) : null, // เพิ่ม user_id ใน payload
      };

      const response = await fetchWithCSRF(
        `/api/apikey/update/${editingApiKey.apikey_id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        setShowEditModal(false);
        setEditingApiKey(null);
        clearForm();
        fetchApiKeys();
      } else {
        const errorData = await response.json();
        setFormError(errorData.message || "เกิดข้อผิดพลาดในการแก้ไข API Key");
      }
    } catch (error) {
      console.error("Error updating API key:", error);
      setFormError("เกิดข้อผิดพลาดในการแก้ไข API Key");
    }
  };

  const clearForm = () => {
    setApiKeyName("");
    setExpireDate("");
    setRateLimit("");
    setAllowedOrigins("");
    setUserId(""); // เพิ่มการ clear user_id
    setFormError("");
  };

  const copyToClipboard = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(id);

      // Show icon when copy succeeds
      setTimeout(() => {
        setCopiedKeyId(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  // ฟิลเตอร์อัตโนมัติเมื่อ searchName หรือ statusFilter เปลี่ยน
  useEffect(() => {
    if (allApiKeys.length > 0) {
      applyFilters(allApiKeys);
    }
  }, [searchName, statusFilter, allApiKeys, applyFilters]);

  // ยังคง handleSearch ไว้สำหรับ submit form (แต่ไม่จำเป็นต้องใช้งานแล้ว)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // ไม่ต้องเรียก applyFilters ซ้ำ เพราะ useEffect ข้างบนจะจัดการให้
  };

  // Function to prepare data for editing
  const prepareEditApiKey = (apiKey: ApiKey) => {
    setEditingApiKey(apiKey);
    setApiKeyName(apiKey.apikey_name);
    setExpireDate(
      apiKey.expire ? new Date(apiKey.expire).toISOString().split("T")[0] : ""
    );
    setRateLimit(apiKey.rate_limit !== null ? apiKey.rate_limit : "");
    setAllowedOrigins(apiKey.allowed_origins || "");
    setUserId(apiKey.user_id !== null ? apiKey.user_id : ""); // เพิ่มการ set user_id
    setShowEditModal(true);
  };

  // แสดง LoadingSpinner ระหว่างรอเช็ค authen
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner color="black" />
      </div>
    );
  }

  // ถ้า logout แล้ว (isLoggedIn === false) ให้ redirect ไปหน้า login
  if (!isLoggedIn) {
    if (typeof window !== "undefined") {
      window.location.href = "/user/login";
    }
    return null;
  }

  // ถ้าไม่ใช่ admin (userRoleId !== 0) แสดง error
  if (userRoleId !== 0) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-300 dark:bg-gray-500">
        <Header />
        <div className="grow flex items-center justify-center p-4">
          <div className="bg-red-600 text-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h1 className="text-xl md:text-2xl font-bold mb-4">
              ไม่มีสิทธิ์เข้าถึง
            </h1>
            <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
            <button
              onClick={() => (window.location.href = "/")}
              className="mt-4 px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-gray-100"
            >
              กลับไปยังหน้าหลัก
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <div className="p-0.5 sm:p-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-0.5">
        <h1 className="text-base sm:text-lg md:text-xl font-bold flex items-center">
          <FaKey className="mr-2 text-yellow-500" />
          จัดการ API Key
        </h1>
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="flex items-center w-full">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="ค้นหาตามชื่อแอปพลิเคชัน..."
              className="w-100 px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-400 rounded-l-lg flex-1 text-xs sm:text-sm focus:border-blue-500 focus:outline-none bg-white shadow-md text-gray-900 placeholder-gray-500"
            />
            <button
              type="submit"
              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 text-xs sm:text-sm font-medium shadow-sm border-2 border-blue-500 hover:border-blue-600 transition-all duration-200"
            >
              ค้นหา
            </button>
          </form>
        </div>
      </div>
      <div className="p-0.5 sm:p-1 flex-1">
        <div className="flex justify-between items-center mb-1">
          <Button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 sm:px-3 rounded text-xs sm:text-sm flex items-center"
            onClick={() => setShowAddModal(true)}
          >
            <FaPlus className="mr-1" />
            สร้าง API Key
          </Button>
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm font-medium text-white">
              สถานะ:
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "active" | "inactive" | "revoke"
                )
              }
              className="px-2 py-1.5 border-2 border-gray-400 rounded-lg text-xs sm:text-sm focus:border-blue-500 focus:outline-none bg-white shadow-md text-gray-900"
            >
              <option value="all">ทั้งหมด</option>
              <option value="active">ใช้งานได้</option>
              <option value="inactive">ไม่ใช้งาน</option>
              <option value="revoke">ถูกเพิกถอน</option>
            </select>
          </div>
        </div>

        {/* API Keys Table - Desktop version */}
        <div className="hidden md:block">
      <table className="table-auto w-full mt-1 text-white bg-gray-700 rounded-lg overflow-hidden text-sm">
            <thead>
              <tr className="bg-gray-800">
        <th className="px-2 py-1 text-left">ชื่อแอปพลิเคชัน</th>
        <th className="px-2 py-1 text-left">API Key</th>
        <th className="px-2 py-1 text-left">User ID</th>
        <th className="px-2 py-1 text-left">สถานะ</th>
        <th className="px-2 py-1 text-left">วันที่สร้าง</th>
        <th className="px-2 py-1 text-left">วันหมดอายุ</th>
        <th className="px-2 py-1 text-left">Rate Limit</th>
        <th className="px-2 py-1 text-left">Allowed Origins</th>
        <th className="px-2 py-1 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="bg-gray-600">
                  <td colSpan={9} className="px-2 py-4 text-center text-white font-medium text-sm">
                    <div className="flex justify-center items-center">
                      <LoadingSpinner color="white" />
                    </div>
                  </td>
                </tr>
              ) : apiKeys.length === 0 ? (
                <tr className="bg-gray-600">
                  <td colSpan={9} className="px-2 py-4 text-center text-white font-medium text-sm">
                    {searchName || statusFilter !== "all"
                      ? "ไม่พบ API Key ที่ตรงกับเงื่อนไขการค้นหา"
                      : "ไม่พบข้อมูล API Key"}
                  </td>
                </tr>
              ) : (
                paginatedApiKeys.map((apiKey) => (
                  <tr
                    key={apiKey.apikey_id}
                    className="border-b border-gray-600 hover:bg-gray-600"
                  >
          <td className="px-2 py-1">{apiKey.apikey_name}</td>
          <td className="px-2 py-1">
                      <div className="flex items-center">
            <span className="truncate max-w-xs bg-gray-600 px-1 py-0.5 rounded border border-gray-500 text-xs text-white">
                          {apiKey.apikey.substring(0, 10)}...
                          {apiKey.apikey.substring(apiKey.apikey.length - 5)}
                        </span>
                      </div>
                    </td>
          <td className="px-2 py-1">
                      {apiKey.user_id || "ไม่ระบุ"}
                    </td>
          <td className="px-2 py-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          apiKey.status === "active"
                            ? "bg-green-600"
                            : apiKey.status === "inactive"
                            ? "bg-yellow-600"
                            : "bg-red-600"
                        }`}
                      >
                        {apiKey.status === "active"
                          ? "ใช้งานได้"
                          : apiKey.status === "inactive"
                          ? "ไม่ใช้งาน"
                          : "ถูกเพิกถอน"}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-sm">
                      {new Date(apiKey.create).toLocaleDateString("th-TH")}
                    </td>
                    <td className="px-2 py-1 text-sm">
                      {apiKey.expire
                        ? new Date(apiKey.expire).toLocaleDateString("th-TH")
                        : "ไม่มีกำหนด"}
                    </td>
                    <td className="px-2 py-1">
                      {apiKey.rate_limit || "ไม่จำกัด"}
                    </td>
                    <td className="px-2 py-1">
                      <div
                        className="truncate max-w-xs bg-gray-600 px-1 py-0.5 rounded border border-gray-500 text-xs"
                        title={apiKey.allowed_origins || ""}
                      >
                        {apiKey.allowed_origins || "ทั้งหมด"}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center justify-center space-x-2">
                        {apiKey.status !== "revoke" && (
                          <>
                            <button
                              onClick={() => prepareEditApiKey(apiKey)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-1 rounded-full transition-all duration-200"
                              title="แก้ไข API Key"
                            >
                              <FaPen size={12} />
                            </button>
                            <button
                              onClick={() =>
                                handleRevokeApiKey(apiKey.apikey_id)
                              }
                              className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 p-1 rounded-full transition-all duration-200"
                              title="เพิกถอน API Key"
                            >
                              <FaTimesCircle size={12} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteApiKey(apiKey.apikey_id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1 rounded-full transition-all duration-200"
                          title="ลบ API Key อย่างถาวร"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {/* Pagination - Desktop */}
          {apiKeys.length > 0 && (
            <div className="flex justify-between items-center mt-4 bg-gray-700 p-2 rounded-lg text-white">
              <div className="flex items-center">
                <span className="text-sm mr-2">แสดง:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1); // Reset to first page when changing items per page
                  }}
                  className="bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  {itemsPerPageOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="text-sm ml-2">รายการต่อหน้า</span>
                <span className="text-sm ml-4">
                  แสดง{" "}
                  {apiKeys.length > 0
                    ? (currentPage - 1) * itemsPerPage + 1
                    : 0}{" "}
                  ถึง {Math.min(currentPage * itemsPerPage, apiKeys.length)} จาก{" "}
                  {apiKeys.length} รายการ
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === 1
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  หน้าแรก
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === 1
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  ก่อนหน้า
                </button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show 5 pages centered around current page when possible
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    pageNum > 0 &&
                    pageNum <= totalPages && (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2 py-1 rounded text-xs ${
                          currentPage === pageNum
                            ? "bg-blue-800 font-bold"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  );
                })}
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === totalPages || totalPages === 0
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  ถัดไป
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === totalPages || totalPages === 0
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  หน้าสุดท้าย
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-1 mt-1">
          {" "}
          {apiKeys.length === 0 ? (
            <div className="text-center text-white py-6 bg-gray-700 rounded-lg shadow-sm border border-gray-600">
              <div className="text-gray-300 mb-2">📄</div>
              <div className="font-medium text-sm">
                {searchName || statusFilter !== "all"
                  ? "ไม่พบ API Key ที่ตรงกับเงื่อนไขการค้นหา"
                  : "ไม่พบข้อมูล API Key"}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {paginatedApiKeys.map((apiKey) => (
                <div
                  key={apiKey.apikey_id}
                  className="bg-gray-700 rounded-lg p-2 border border-gray-600"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">
                        {apiKey.apikey_name}
                      </h3>
                      <p className="text-gray-300 text-xs">
                        {apiKey.apikey.substring(0, 10)}...
                        {apiKey.apikey.substring(apiKey.apikey.length - 5)}
                      </p>
                      <p className="text-gray-300 text-xs">
                        User ID: {apiKey.user_id || "ไม่ระบุ"}
                      </p>
                      <p className="text-gray-300 text-xs mt-1">
                        <span className="bg-blue-600 px-1.5 py-0.5 rounded">
                          {apiKey.rate_limit
                            ? `Rate: ${apiKey.rate_limit}/m`
                            : "ไม่จำกัด Rate"}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        apiKey.status === "active"
                          ? "bg-green-600"
                          : apiKey.status === "inactive"
                          ? "bg-yellow-600"
                          : "bg-red-600"
                      }`}
                    >
                      {apiKey.status === "active"
                        ? "ใช้งานได้"
                        : apiKey.status === "inactive"
                        ? "ไม่ใช้งาน"
                        : "ถูกเพิกถอน"}
                    </span>
                  </div>
                  <div className="flex space-x-2 justify-center">
                    {apiKey.status !== "revoke" && (
                      <>
                        <button
                          onClick={() => prepareEditApiKey(apiKey)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-2 rounded-full transition-all duration-200 flex-1 max-w-[100px] flex items-center justify-center"
                          title="แก้ไข API Key"
                        >
                          <FaPen size={12} className="mr-1" /> แก้ไข
                        </button>
                        <button
                          onClick={() => handleRevokeApiKey(apiKey.apikey_id)}
                          className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 p-2 rounded-full transition-all duration-200 flex-1 max-w-[100px] flex items-center justify-center"
                          title="เพิกถอน API Key"
                        >
                          <FaTimesCircle size={12} className="mr-1" /> เพิกถอน
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteApiKey(apiKey.apikey_id)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-100 p-2 rounded-full transition-all duration-200 flex-1 max-w-[100px] flex items-center justify-center"
                      title="ลบ API Key อย่างถาวร"
                    >
                      <FaTrash size={12} className="mr-1" /> ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Pagination - Mobile */}
          {apiKeys.length > 0 && (
            <div className="bg-gray-700 p-2 rounded-lg mt-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <span className="text-xs mr-1">แสดง:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-gray-800 text-white border border-gray-600 rounded px-1 py-1 text-xs"
                  >
                    {itemsPerPageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs ml-1">รายการ</span>
                </div>
                <span className="text-xs">
                  {apiKeys.length > 0
                    ? (currentPage - 1) * itemsPerPage + 1
                    : 0}
                  -{Math.min(currentPage * itemsPerPage, apiKeys.length)}/
                  {apiKeys.length}
                </span>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === 1
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600"
                  }`}
                >
                  หน้าแรก
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === 1
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600"
                  }`}
                >
                  ก่อนหน้า
                </button>
                <span className="text-xs flex items-center">
                  หน้า {currentPage}/{totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === totalPages || totalPages === 0
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600"
                  }`}
                >
                  ถัดไป
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === totalPages || totalPages === 0
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600"
                  }`}
                >
                  หน้าสุดท้าย
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add API Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md my-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                สร้าง API Key ใหม่
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  clearForm();
                }}
                className="text-gray-600 hover:text-gray-800 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            {formError && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg flex items-center text-base font-medium border border-red-300">
                <FaExclamationTriangle className="mr-2 shrink-0" />
                {formError}
              </div>
            )}
            <form onSubmit={handleAddApiKey} className="space-y-6">
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  ชื่อแอปพลิเคชันหรือเว็บไซต์ *
                </label>
                <input
                  type="text"
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 placeholder-gray-600 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  placeholder="ระบุชื่อแอปพลิเคชันหรือเว็บไซต์"
                  required
                />
              </div>
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  User ID
                </label>
                <input
                  type="number"
                  value={userId}
                  onChange={(e) =>
                    setUserId(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 placeholder-gray-600 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  placeholder="ระบุ User ID (ถ้ามี)"
                  min="1"
                />
                <p className="text-gray-700 text-sm mt-2 font-medium">
                  ไม่ระบุเพื่อกำหนดเจ้าของ API Key
                </p>
              </div>
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  วันหมดอายุ
                </label>
                <input
                  type="date"
                  value={expireDate}
                  onChange={(e) => setExpireDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  min={new Date().toISOString().split("T")[0]}
                />
                <p className="text-gray-700 text-sm mt-2 font-medium">
                  หากไม่ระบุ จะไม่มีวันหมดอายุ
                </p>
              </div>
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  Rate Limit (จำนวนคำขอต่อนาที)
                </label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) =>
                    setRateLimit(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 placeholder-gray-600 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  placeholder="ระบุ rate limit"
                  min="1"
                />
                <p className="text-gray-700 text-sm mt-2 font-medium">
                  หากไม่ระบุ จะไม่มีการจำกัด
                </p>
              </div>
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  Allowed Origins: URL หรือ IP Address
                </label>
                <input
                  type="text"
                  value={allowedOrigins}
                  onChange={(e) => setAllowedOrigins(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 placeholder-gray-600 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  placeholder="https://example.com,http://192.168.1.1"
                />
                <p className="text-gray-700 text-sm mt-2 font-medium">
                  สามารถระบุได้ทั้ง URL คั่นด้วยเครื่องหมายจุลภาค (,) หากไม่ระบุ
                  จะอนุญาตทุก Origin
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    clearForm();
                  }}
                  className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 text-base font-bold transition-colors duration-200 shadow-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-base font-bold transition-colors duration-200 shadow-md"
                >
                  สร้าง API Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit API Key Modal */}
      {showEditModal && editingApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md my-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                แก้ไข API Key
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingApiKey(null);
                  clearForm();
                }}
                className="text-gray-600 hover:text-gray-800 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            {formError && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg flex items-center text-base font-medium border border-red-300">
                <FaExclamationTriangle className="mr-2 shrink-0" />
                {formError}
              </div>
            )}
            <form onSubmit={handleEditApiKey} className="space-y-6">
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  ชื่อแอปพลิเคชันหรือเว็บไซต์ *
                </label>
                <input
                  type="text"
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 placeholder-gray-600 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  placeholder="ระบุชื่อแอปพลิเคชันหรือเว็บไซต์"
                  required
                />
              </div>
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  User ID
                </label>
                <input
                  type="number"
                  value={userId}
                  onChange={(e) =>
                    setUserId(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 placeholder-gray-600 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  placeholder="ระบุ User ID (ถ้ามี)"
                  min="1"
                />
                <p className="text-gray-700 text-sm mt-2 font-medium">
                  หากไม่ระบุ API Key จะไม่มีการกำหนดเจ้าของ
                </p>
              </div>
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  วันหมดอายุ
                </label>
                <input
                  type="date"
                  value={expireDate}
                  onChange={(e) => setExpireDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  min={new Date().toISOString().split("T")[0]}
                />
                <p className="text-gray-700 text-sm mt-2 font-medium">
                  หากไม่ระบุ จะไม่มีวันหมดอายุ
                </p>
              </div>
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  Rate Limit (จำนวนคำขอต่อนาที)
                </label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) =>
                    setRateLimit(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 placeholder-gray-600 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  placeholder="ระบุ rate limit"
                  min="1"
                />
                <p className="text-gray-700 text-sm mt-2 font-medium">
                  หากไม่ระบุ จะไม่มีการจำกัด
                </p>
              </div>
              <div className="form-group">
                <label className="block mb-3 font-bold text-lg text-gray-800">
                  Allowed Origins: URL หรือ IP Address
                </label>
                <input
                  type="text"
                  value={allowedOrigins}
                  onChange={(e) => setAllowedOrigins(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-lg text-gray-900 placeholder-gray-600 focus:border-blue-600 focus:outline-none bg-white transition-colors duration-200 font-medium shadow-sm"
                  placeholder="https://example.com,http://192.168.1.1"
                />
                <p className="text-gray-700 text-sm mt-2 font-medium">
                  สามารถระบุได้ทั้ง URL คั่นด้วยเครื่องหมายจุลภาค (,) หากไม่ระบุ
                  จะอนุญาตทุก Origin
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingApiKey(null);
                    clearForm();
                  }}
                  className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 text-base font-bold transition-colors duration-200 shadow-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-base font-bold transition-colors duration-200 shadow-md"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md my-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-green-600">
                สร้าง API Key สำเร็จ
              </h2>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>

            <div className="mb-6">
              <p className="mb-2 text-sm">API Key ของคุณ:</p>
              <div className="bg-gray-100 p-3 rounded font-mono break-all text-xs sm:text-sm">
                {newApiKey}
              </div>
              <button
                onClick={() => newApiKey && copyToClipboard(newApiKey, 0)}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded flex items-center text-sm"
              >
                {copiedKeyId === 0 ? (
                  <>
                    <FaCheck className="mr-2" /> คัดลอกแล้ว!
                  </>
                ) : (
                  <>
                    <FaCopy className="mr-2" /> คัดลอก API Key
                  </>
                )}
              </button>
              <p className="text-red-500 mt-4 flex items-start text-xs sm:text-sm">
                <FaExclamationTriangle className="mr-1 mt-0.5 shrink-0" />
                กรุณาจดบันทึก API Key นี้เนื่องจากคุณจะไม่สามารถเปิดดูได้อีก
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
