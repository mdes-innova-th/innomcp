"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/app/components/common/ui/button";
import UserModal, { User } from "@/app/components/user/modal/UserModal";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { useAuth } from "@/app/context/AuthContext";
import { FaUserPlus, FaUser, FaPen, FaTrash } from "react-icons/fa";
import { fetchWithCSRF } from "@/utils/csrf";

export default function UserManagement() {
  const { isLoggedIn, isAuthLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // Store all users for filtering
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [roleNames, setRoleNames] = useState<{ [key: string]: string }>({}); // Will be populated from API
  const [isLoading, setIsLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [paginatedUsers, setPaginatedUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPageOptions = [5, 10, 25, 50, 100];

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch("/api/user/roles", {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          const rolesMap: { [key: string]: string } = {};

          // Convert array of roles to map for easy lookup
          data.roles.forEach(
            (role: { userrole_id: string; userrole_name: string }) => {
              rolesMap[role.userrole_id] = role.userrole_name;
            }
          );

          setRoleNames(rolesMap);
        } else {
          console.error("Failed to fetch roles");
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
      }
    };

    fetchRoles();
  }, []); // Use useCallback for applyFilters to avoid dependency issues in useEffect
  const applyFilters = useCallback(
    (usersData: User[]) => {
      // Apply search filters
      const filtered = usersData.filter((user) => {
        // Search filter - check if user ID, username, email, display name, or role name contains the search term
        const matchesSearch =
          searchTerm === "" ||
          user.user_id.toString().includes(searchTerm) ||
          user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.user_dispname.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (roleNames[user.userrole_id] &&
            roleNames[user.userrole_id]
              .toLowerCase()
              .includes(searchTerm.toLowerCase()));

        return matchesSearch;
      });

      // Calculate total pages
      const calculatedTotalPages = Math.ceil(filtered.length / itemsPerPage);
      setTotalPages(calculatedTotalPages);

      // Adjust current page if it's out of bounds after filtering
      if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
        setCurrentPage(1);
      }

      // Store the filtered results
      setUsers(filtered);
    },
    [searchTerm, roleNames, itemsPerPage, currentPage]
  );

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/list", {
        method: "GET",
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users);
        applyFilters(data.users);
      } else {
        console.error("Failed to fetch users");
      }
    } catch (error) {
      console.error("catch-Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }, [applyFilters]);

  // เมื่อ auth โหลดเสร็จและเป็น admin (userrole_id === 0) ให้ fetchUsers
  useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      fetchUsers();
    }
  }, [isAuthLoading, isLoggedIn, fetchUsers]);

  // Apply filters when allUsers changes or filter dependencies change
  useEffect(() => {
    if (allUsers.length > 0) {
      applyFilters(allUsers);
    }
  }, [allUsers, applyFilters]);

  // Update paginated users when users or currentPage/itemsPerPage change
  useEffect(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    setPaginatedUsers(users.slice(startIdx, endIdx));
    setTotalPages(Math.ceil(users.length / itemsPerPage));
  }, [users, currentPage, itemsPerPage]);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้นี้?")) {
      return;
    }
    try {
      const response = await fetchWithCSRF(`/api/user/delete?id=${userId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchUsers();
      } else {
        console.error("Failed to delete user", response.statusText);
      }
    } catch (error) {
      console.error("catch-Error deleting user:", error);
    }
  };

  const handleSave = async (
    userData: User | (Omit<User, "user_id"> & { password: string })
  ) => {
    try {
      const method = isEditing ? "PUT" : "POST";
      const endpoint = isEditing ? "/api/user/update" : "/api/user/register";
      const response = await fetchWithCSRF(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        console.error("Failed to save user");
      }
    } catch (error) {
      console.error("catch-Error saving user:", error);
    }
  };

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The search is already applied as you type, but this function is needed for the form submission
    if (allUsers.length > 0) {
      applyFilters(allUsers);
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page on items per page change
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
  return (
    <>
      <div className="p-0.5 sm:p-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-0.5">
        {" "}
        <h1 className="text-base sm:text-lg md:text-xl font-bold flex items-center">
          <FaUser className="mr-2 text-yellow-500" />
          จัดการผู้ใช้งาน
        </h1>
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="flex items-center w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาด้วย User ID, ชื่อผู้ใช้, อีเมล หรือบทบาท..."
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
        <Button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 sm:px-3 rounded text-xs sm:text-sm mb-1 flex items-center"
          onClick={() => {
            setIsEditing(false);
            setIsModalOpen(true);
          }}
        >
          <FaUserPlus className="mr-1" />
          เพิ่มผู้ใช้
        </Button>{" "}
        {/* Desktop Table */}
        <div className="hidden md:block">
      <table className="table-auto w-full mt-1 text-white bg-gray-700 rounded-lg overflow-hidden text-sm">
            <thead>
              <tr className="bg-gray-800">
        <th className="px-2 py-1 text-left">User ID</th>
        <th className="px-2 py-1 text-left">ชื่อผู้ใช้</th>
        <th className="px-2 py-1 text-left">ชื่อ</th>
        <th className="px-2 py-1 text-left">อีเมล</th>
        <th className="px-2 py-1 text-left">หมายเลขโทรศัพท์</th>
        <th className="px-2 py-1 text-left">สถานะ</th>
        <th className="px-2 py-1 text-left">บทบาท</th>
        <th className="px-2 py-1 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="bg-gray-600">
                  <td colSpan={8} className="px-2 py-4 text-center text-white font-medium text-sm">
                    <div className="flex justify-center items-center">
                      <LoadingSpinner color="white" />
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr className="bg-gray-600">
                  <td colSpan={8} className="px-2 py-4 text-center text-white font-medium text-sm">
                    ไม่พบข้อมูลผู้ใช้
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b border-gray-600 hover:bg-gray-600"
                  >
                    <td className="px-2 py-1">{user.user_id}</td>
                    <td className="px-2 py-1">{user.username}</td>
                    <td className="px-2 py-1">{user.user_dispname}</td>
                    <td className="px-2 py-1">{user.user_email}</td>
                    <td className="px-2 py-1">
                      {user.user_phone || "-"}
                    </td>
                    <td className="px-2 py-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          user.user_active === "1" ? "bg-green-600" : "bg-red-600"
                        }`}
                      >
                        {user.user_active === "1" ? "ใช้งานได้" : "ปิดการใช้งาน"}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      {roleNames[user.userrole_id] || "ไม่ระบุบทบาท"}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-1 rounded-full transition-all duration-200"
                          title="แก้ไขผู้ใช้"
                        >
                          <FaPen size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.user_id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1 rounded-full transition-all duration-200"
                          title="ลบผู้ใช้"
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

          {/* Pagination Controls - Desktop */}
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
                {users.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}{" "}
                ถึง {Math.min(currentPage * itemsPerPage, users.length)} จาก{" "}
                {users.length} รายการ
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
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
        </div>{" "}
        {/* Mobile Cards */}
        <div className="md:hidden space-y-1 mt-1">
          {isLoading ? (
            <div className="flex justify-center items-center py-6 bg-gray-700 rounded-lg shadow-sm border border-gray-600">
              <LoadingSpinner color="white" />
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="text-center text-white py-6 bg-gray-700 rounded-lg shadow-sm border border-gray-600">
              <div className="text-gray-300 mb-2">📄</div>
              <div className="font-medium text-sm">ไม่พบข้อมูลผู้ใช้</div>
            </div>
          ) : (
            paginatedUsers.map((user) => (
              <div
                key={user.user_id}
                className="bg-gray-700 rounded-lg p-2 border border-gray-600"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    {" "}
                    <h3 className="font-semibold text-base">
                      {user.user_dispname}
                    </h3>
                    <p className="text-gray-300 text-xs">
                      User ID: {user.user_id}
                    </p>
                    <p className="text-gray-300 text-xs">@{user.username}</p>
                    <p className="text-gray-300 text-xs">{user.user_email}</p>
                    <p className="text-gray-300 text-xs">
                      {user.user_phone || "-"}
                    </p>
                    <p className="text-gray-300 text-xs mt-1">
                      <span className="bg-blue-600 px-1.5 py-0.5 rounded">
                        {roleNames[user.userrole_id] || "ไม่ระบุบทบาท"}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs ${
                      user.user_active === "1" ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    {user.user_active === "1" ? "ใช้งานได้" : "ปิดการใช้งาน"}
                  </span>
                </div>{" "}
                <div className="flex space-x-2 justify-center">
                  <button
                    onClick={() => handleEdit(user)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-2 rounded-full transition-all duration-200 flex-1 max-w-[100px] flex items-center justify-center"
                    title="แก้ไขผู้ใช้"
                  >
                    <FaPen size={12} className="mr-1" /> แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(user.user_id)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-100 p-2 rounded-full transition-all duration-200 flex-1 max-w-[100px] flex items-center justify-center"
                    title="ลบผู้ใช้"
                  >
                    <FaTrash size={12} className="mr-1" /> ลบ
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Pagination Controls - Mobile */}
          <div className="bg-gray-700 p-2 rounded-lg mt-3">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <span className="text-xs mr-1">แสดง:</span>
                <select
                  value={itemsPerPage}
                  onChange={handleItemsPerPageChange}
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
                {users.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                {Math.min(currentPage * itemsPerPage, users.length)}/
                {users.length}
              </span>
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => handlePageChange(1)}
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
                onClick={() => handlePageChange(currentPage - 1)}
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
                onClick={() => handlePageChange(currentPage + 1)}
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
                onClick={() => handlePageChange(totalPages)}
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
        </div>
        {isModalOpen && (
          <UserModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            user={selectedUser}
            isEditing={isEditing}
          />
        )}
      </div>
    </>
  );
}
