import React from "react";
import "./modalinfo.css";
import { FaCircleCheck, FaCircleXmark, FaCircleInfo } from "react-icons/fa6";
import { FaExclamationCircle } from "react-icons/fa";

interface ModalInfoProps {
  open: boolean;
  message: string;
  type?: "success" | "warning" | "danger" | "info";
  onClose: () => void;
}

const ICONS = {
  success: (
    <FaCircleCheck
      className="modalIconFa modalIconSuccess"
      aria-hidden="true"
    />
  ),
  warning: (
    <FaExclamationCircle
      className="modalIconFa modalIconWarning"
      aria-hidden="true"
    />
  ),
  danger: (
    <FaCircleXmark className="modalIconFa modalIconDanger" aria-hidden="true" />
  ),
  info: (
    <FaCircleInfo className="modalIconFa modalIconInfo" aria-hidden="true" />
  ),
};

const ModalInfo: React.FC<ModalInfoProps> = ({
  open,
  message,
  type = "success",
  onClose,
}) => {
  if (!open) return null;
  return (
    <div className="modalOverlay">
      <div className="modalBox">
        <div className="modalIcon">{ICONS[type]}</div>
        <div className="modalMessage">{message}</div>
        <button onClick={onClose} className="modalCloseBtn">
          ปิด
        </button>
      </div>
    </div>
  );
};

export default ModalInfo;
