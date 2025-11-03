import React from "react";

interface ViolationTypeUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  urls: string[];
  startDate?: string; // yyyy-mm-dd
  endDate?: string; // yyyy-mm-dd
}

const ViolationTypeUrlModal: React.FC<ViolationTypeUrlModalProps> = ({
  isOpen,
  onClose,
  groupName,
  urls,
  startDate = "",
  endDate = "",
}) => {
  if (!isOpen) return null;

  // ฟังก์ชันแปลงวันที่เป็นไทยแบบ วว/ดด/ปปปป
  const toThaiDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear().toString();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full p-2 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
          aria-label="ปิด"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="3"
          >
            <line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="18"
              x2="18"
              y2="6"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="text-sm text-gray-600 mb-1">
          <b>
            ข้อมูลช่วงวันที่ {toThaiDate(startDate)} - {toThaiDate(endDate)}
          </b>
        </div>
        <h2 className="text-lg font-bold mb-2">URL ประเภท {groupName}</h2>
        <div className="max-h-80 overflow-y-auto border rounded p-2 bg-gray-50">
          {urls.length === 0 ? (
            <div className="text-gray-500 text-center">
              ไม่พบ URL ในกลุ่มนี้
            </div>
          ) : (
            <ul className="list-decimal pl-5">
              {urls.map((url, idx) => (
                <li
                  key={idx}
                  className="mb-1 flex items-center justify-between"
                >
                  <span className="break-all">{url}</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 px-2 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 cursor-pointer"
                  >
                    เปิด
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViolationTypeUrlModal;
