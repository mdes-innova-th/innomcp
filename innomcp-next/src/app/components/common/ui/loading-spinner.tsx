"use client";

type AnimationStyle = "spinner" | "dots" | "square" | "bars";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  color?: string;
  type?: AnimationStyle;
}

export default function LoadingSpinner({
  className = "",
  size = "md", // default size for all pages
  color = "white",
  type = "spinner", // default type
}: LoadingSpinnerProps) {
  // Base container class
  const containerClass = `flex items-center justify-center ${className}`;

  // Size mappings
  const getSizeClass = (forType: AnimationStyle = type) => {
    switch (size) {
      case "sm":
        if (forType === "dots" || forType === "bars") {
          return "h-2 w-2";
        }
        return "h-5 w-5 border-2";
      case "lg":
        if (forType === "dots" || forType === "bars") {
          return "h-4 w-4";
        }
        return "h-16 w-16 border-8";
      default:
        if (forType === "dots" || forType === "bars") {
          return "h-3 w-3";
        }
        return "h-10 w-10 border-4";
    }
  };

  // Get color classes based on color prop
  const getColorClasses = (forBorder: boolean = true) => {
    const borderColorMap: Record<string, string> = {
      white: "border-white",
      black: "border-black",
      blue: "border-blue-500",
      "light-blue": "border-blue-300",
      "dark-blue": "border-blue-700",
      red: "border-red-500",
      green: "border-green-500",
      yellow: "border-yellow-500",
      purple: "border-purple-500",
      pink: "border-pink-500",
      indigo: "border-indigo-500",
      gray: "border-gray-500",
      "light-gray": "border-gray-300",
      "dark-gray": "border-gray-700",
      teal: "border-teal-500",
      orange: "border-orange-500",
      lime: "border-lime-500",
      cyan: "border-cyan-500",
      amber: "border-amber-500",
      emerald: "border-emerald-500",
      fuchsia: "border-fuchsia-500",
      violet: "border-violet-500",
      rose: "border-rose-500",
    };
    
    const bgColorMap: Record<string, string> = {
      white: "bg-white",
      black: "bg-black",
      blue: "bg-blue-500",
      "light-blue": "bg-blue-300",
      "dark-blue": "bg-blue-700",
      red: "bg-red-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      pink: "bg-pink-500",
      indigo: "bg-indigo-500",
      gray: "bg-gray-500",
      "light-gray": "bg-gray-300",
      "dark-gray": "bg-gray-700",
      teal: "bg-teal-500",
      orange: "bg-orange-500",
      lime: "bg-lime-500",
      cyan: "bg-cyan-500",
      amber: "bg-amber-500",
      emerald: "bg-emerald-500",
      fuchsia: "bg-fuchsia-500",
      violet: "bg-violet-500",
      rose: "bg-rose-500",
    };
    
    if (forBorder) {
      return borderColorMap[String(color)] || "border-white";
    } else {
      return bgColorMap[String(color)] || "bg-white";
    }
  };

  // Render the spinner animation
  const renderAnimation = () => {
    const borderColorClasses = getColorClasses(true);
    const bgColorClasses = getColorClasses(false);
    const barSizeClasses =
      size === "sm"
        ? "h-4 w-[3px]"
        : size === "lg"
        ? "h-8 w-[6px]"
        : "h-6 w-1";

    switch (type) {
      case "dots":
        const dotSizeClasses = getSizeClass("dots");
        return (
          <div
            className={`flex space-x-2 ${containerClass}`}
            aria-label="Loading"
          >
            <div
              className={`animate-bounce rounded-full ${bgColorClasses} ${dotSizeClasses} [animation-delay:0s]`}
            ></div>
            <div
              className={`animate-bounce rounded-full ${bgColorClasses} ${dotSizeClasses} [animation-delay:200ms]`}
            ></div>
            <div
              className={`animate-bounce rounded-full ${bgColorClasses} ${dotSizeClasses} [animation-delay:400ms]`}
            ></div>
          </div>
        );
      case "square":
        const squareSizeClasses = getSizeClass("square");
        return (
          <div
            className={`animate-flip ${squareSizeClasses} ${bgColorClasses} rounded-sm`}
            aria-label="Loading"
          ></div>
        );
      case "bars":
        return (
          <div
            className={`flex items-end space-x-1 ${containerClass}`}
            aria-label="Loading"
          >
            <div
              className={`animate-bars rounded-sm ${bgColorClasses} ${barSizeClasses} [animation-delay:0s]`}
            ></div>
            <div
              className={`animate-bars rounded-sm ${bgColorClasses} ${barSizeClasses} [animation-delay:150ms]`}
            ></div>
            <div
              className={`animate-bars rounded-sm ${bgColorClasses} ${barSizeClasses} [animation-delay:300ms]`}
            ></div>
            <div
              className={`animate-bars rounded-sm ${bgColorClasses} ${barSizeClasses} [animation-delay:450ms]`}
            ></div>
          </div>
        );
      default:
        // Default to spinner
        const spinnerSizeClasses = getSizeClass("spinner");
        return (
          <div
            className={`animate-spin rounded-full ${spinnerSizeClasses} border-t-transparent ${borderColorClasses}`}
            aria-label="Loading"
          ></div>
        );
    }
  };
  return (
    <div className={containerClass}>
      {renderAnimation()}
    </div>
  );
}
