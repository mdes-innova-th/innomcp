import * as React from "react";
interface Pagination {
  totalDatas: number;
  page: number;
  previousPage: number | null;
  nextPage: number | null;
  totalPages: number;
  indexDataStart: number;
  indexDataStop: number;
  limit: number;
}
interface PaginationProps {
  pagination: Pagination;
  setPagination: React.Dispatch<React.SetStateAction<Pagination>>;
  itemsPerPageOptions: number[];
}

const DesktopPagination: React.FC<PaginationProps> = ({
  pagination,
  setPagination,
  itemsPerPageOptions = [5, 10, 25, 50],
}) => {
  return (
    <div className="hidden md:flex justify-between items-center mt-4 bg-gray-700 p-2 rounded-lg text-white">
      <div className="flex items-center">
        <span className="text-sm mr-2">แสดง:</span>
        <select
          value={pagination.limit}
          onChange={(e) => {
            setPagination((prev) => ({
              ...prev,
              limit: Number(e.target.value),
              page: 1,
            }));
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
          แสดง {pagination.indexDataStart} ถึง {pagination.indexDataStop} จาก{" "}
          {pagination.totalDatas} รายการ
        </span>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() =>
            setPagination({
              ...pagination,
              page: 1,
            })
          }
          disabled={pagination.page === 1 || !pagination.totalDatas}
          className={`px-2 py-1 rounded text-xs ${
            pagination.page === 1 || !pagination.totalDatas
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
          }`}
        >
          หน้าแรก
        </button>
        <button
          onClick={() =>
            pagination.previousPage &&
            setPagination({
              ...pagination,
              page: pagination.previousPage,
            })
          }
          disabled={pagination.page === 1 || !pagination.totalDatas}
          className={`px-2 py-1 rounded text-xs ${
            pagination.page === 1 || !pagination.totalDatas
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
          }`}
        >
          ก่อนหน้า
        </button>
        {Array.from({ length: Math.min(5, pagination.totalDatas) }, (_, i) => {
          // Show 5 pages centered around current page when possible
          let pageNum;
          if (pagination.totalPages <= 5) {
            pageNum = i + 1;
          } else if (pagination.page <= 3) {
            pageNum = i + 1;
          } else if (pagination.page >= pagination.totalPages - 2) {
            pageNum = pagination.totalPages - 4 + i;
          } else {
            pageNum = pagination.page - 2 + i;
          }

          return (
            pageNum > 0 &&
            pageNum <= pagination.totalPages && (
              <button
                key={pageNum}
                onClick={() =>
                  setPagination({
                    ...pagination,
                    page: pageNum,
                  })
                }
                className={`px-2 py-1 rounded text-xs ${
                  pagination.page === pageNum
                    ? "bg-blue-800 font-bold"
                    : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                }`}
              >
                {pageNum}
              </button>
            )
          );
        })}
        <button
          onClick={() =>
            pagination.nextPage &&
            setPagination({
              ...pagination,
              page: pagination.nextPage,
            })
          }
          disabled={
            pagination.page === pagination.totalPages ||
            pagination.totalPages === 0
          }
          className={`px-2 py-1 rounded text-xs ${
            pagination.page === pagination.totalPages ||
            pagination.totalPages === 0
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
          }`}
        >
          ถัดไป
        </button>
        <button
          onClick={() =>
            setPagination({
              ...pagination,
              page: pagination.totalPages,
            })
          }
          disabled={
            pagination.page === pagination.totalPages ||
            pagination.totalPages === 0
          }
          className={`px-2 py-1 rounded text-xs ${
            pagination.page === pagination.totalPages ||
            pagination.totalPages === 0
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
          }`}
        >
          หน้าสุดท้าย
        </button>
      </div>
    </div>
  );
};

const MobilePagination: React.FC<PaginationProps> = ({
  pagination,
  setPagination,
  itemsPerPageOptions = [5, 10, 25, 50],
}) => {
  return (
    <div className="bg-gray-700 p-2 rounded-lg mt-3 text-white">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <span className="text-xs mr-1">แสดง:</span>
          <select
            value={pagination.limit}
            onChange={(e) => {
              setPagination((prev) => ({
                ...prev,
                limit: Number(e.target.value),
                page: 1,
              }));
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
          {pagination.indexDataStart}-{pagination.indexDataStop}/
          {pagination.totalDatas}
        </span>
      </div>
      <div className="flex justify-between">
        <div>
          <button
            onClick={() =>
              setPagination({
                ...pagination,
                page: 1,
              })
            }
            disabled={pagination.page === 1 || !pagination.totalDatas}
            className={`px-2 py-1 rounded text-xs mr-3 ${
              pagination.page === 1 || !pagination.totalDatas
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600"
            }`}
          >
            หน้าแรก
          </button>
          <button
            onClick={() =>
              pagination.previousPage &&
              setPagination({
                ...pagination,
                page: pagination.previousPage,
              })
            }
            disabled={pagination.page === 1 || !pagination.totalDatas}
            className={`px-2 py-1 rounded text-xs ${
              pagination.page === 1 || !pagination.totalDatas
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600"
            }`}
          >
            ก่อนหน้า
          </button>
        </div>
        {pagination.totalPages > 0 && (
          <span className="text-xs flex items-center">
            หน้า {pagination.page}/{pagination.totalPages}
          </span>
        )}
        <div>
          <button
            onClick={() =>
              pagination.nextPage &&
              setPagination({
                ...pagination,
                page: pagination.nextPage,
              })
            }
            disabled={
              pagination.page === pagination.totalPages ||
              pagination.totalPages === 0
            }
            className={`px-2 py-1 rounded text-xs mr-3 ${
              pagination.page === pagination.totalPages ||
              pagination.totalPages === 0
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600"
            }`}
          >
            ถัดไป
          </button>
          <button
            onClick={() =>
              setPagination({
                ...pagination,
                page: pagination.totalPages,
              })
            }
            disabled={
              pagination.page === pagination.totalPages ||
              pagination.totalPages === 0
            }
            className={`px-2 py-1 rounded text-xs ${
              pagination.page === pagination.totalPages ||
              pagination.totalPages === 0
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600"
            }`}
          >
            หน้าสุดท้าย
          </button>
        </div>
      </div>
    </div>
  );
};

export { DesktopPagination, MobilePagination };
