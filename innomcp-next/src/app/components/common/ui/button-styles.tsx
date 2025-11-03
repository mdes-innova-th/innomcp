// Common button style classes
export const buttonBaseClass =
  "px-2 py-1.5 m-2 rounded-full flex items-center justify-center whitespace-nowrap text-gray-800 transition-colors duration-200 cursor-pointer";
export const buttonClass = `${buttonBaseClass} bg-white hover:bg-yellow-400 active:bg-yellow-500`;
export const logoutButtonClass = `${buttonClass} m-1`;

// Mobile-specific button classes
export const mobileButtonClass = "mb-0.5 py-1.5 mx-2";

// Desktop-specific button classes
export const desktopButtonClass = "";

// For disabled states
export const disabledButtonClass = "cursor-not-allowed opacity-50";

// Legacy exports for backward compatibility (all pointing to the same style)
export const primaryButtonClass = buttonClass;
export const secondaryButtonClass = buttonClass;
export const dangerButtonClass = buttonClass;
export const successButtonClass = buttonClass;
export const warningButtonClass = buttonClass;
export const infoButtonClass = buttonClass;
export const grayButtonClass = buttonClass;
