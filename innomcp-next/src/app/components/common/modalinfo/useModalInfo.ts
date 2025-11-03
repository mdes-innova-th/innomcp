import { useState } from "react";

type ModalType = "success" | "warning" | "danger" | "info";

export function useModalInfo() {
  const [modalInfo, setModalInfo] = useState<{
    open: boolean;
    message: string;
    type?: ModalType;
  }>({
    open: false,
    message: "",
    type: "success",
  });

  const showModal = (message: string, type: ModalType = "success") =>
    setModalInfo({ open: true, message, type });

  const closeModal = () =>
    setModalInfo({ open: false, message: "", type: "success" });

  return { modalInfo, showModal, closeModal };
}
