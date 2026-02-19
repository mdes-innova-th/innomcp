// Common button style classes - Updated to use team theme
export const buttonBaseClass =
  "px-2 py-1.5 m-2 rounded-full flex items-center justify-center whitespace-nowrap text-primary-foreground transition-colors duration-200 cursor-pointer";
export const buttonClass = `${buttonBaseClass} bg-secondary hover:bg-secondary/80 active:bg-secondary/70`;
export const logoutButtonClass = `${buttonClass} m-1 bg-destructive hover:bg-destructive/90 active:bg-destructive/80`;

// Mobile-specific button classes
export const mobileButtonClass = "mb-0.5 py-1.5 mx-2";

// Desktop-specific button classes
export const desktopButtonClass = "";

// For disabled states
export const disabledButtonClass = "cursor-not-allowed opacity-50";

// Legacy exports for backward compatibility (all pointing to the same style)
export const primaryButtonClass = buttonClass;
export const secondaryButtonClass = buttonClass;
export const dangerButtonClass = `${buttonBaseClass} bg-destructive hover:bg-destructive/90`;
export const successButtonClass = `${buttonBaseClass} bg-secondary hover:bg-secondary/80`;
export const warningButtonClass = `${buttonBaseClass} bg-accent hover:bg-accent/80`;
export const infoButtonClass = buttonClass;
export const grayButtonClass = `${buttonBaseClass} bg-muted text-muted-foreground hover:bg-muted/80`;

