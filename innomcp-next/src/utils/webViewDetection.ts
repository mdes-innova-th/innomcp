
/**
 * Shared logic for WebView detection
 * @param userAgent - The user agent string
 * @param getHeader - Function to get header value by name (optional)
 */
function detectWebView(userAgent: string, getHeader?: (name: string) => string | null): boolean {
  if (!userAgent) return false;
  const userAgentLower = userAgent.toLowerCase();

  // Custom headers
  const customWebViewHeaders = [
    "X-Requested-With",
    "X-WebView-Version",
    "X-App-Version",
    "X-Mobile-App",
  ];
  const hasWebViewHeaders = getHeader
    ? customWebViewHeaders.some((header) => getHeader(header) !== null)
    : false;

  // Android WebView
  const isAndroidWebView = userAgentLower.includes("android") && userAgentLower.includes("wv");

  // iOS WebView - Improved detection
  const isIOSWebView = 
    (userAgentLower.includes("iphone") || userAgentLower.includes("ipad")) &&
    (
      // WKWebView pattern - Safari without Version
      (userAgentLower.includes("safari") && !userAgentLower.includes("version")) ||
      // UIWebView pattern - has Version and Mobile
      (userAgentLower.includes("safari") && userAgentLower.includes("version") && userAgentLower.includes("mobile")) ||
      // App WebView without Safari string but has WebKit
      (!userAgentLower.includes("safari") && userAgentLower.includes("webkit")) ||
      // Generic iOS WebView patterns
      userAgentLower.includes("webview") ||
      // iOS app pattern - Mobile/ without Safari
      (userAgentLower.includes("mobile/") && !userAgentLower.includes("safari")) ||
      // WKWebView with custom user agent
      userAgentLower.includes("wkwebview") ||
      // Native app pattern
      (userAgentLower.includes("webkit") && !userAgentLower.includes("chrome") && !userAgentLower.includes("firefox"))
    );

  // Patterns
  const webViewPatterns = [
    /webview/i,
    /android.*wv/i,
    /mobile.*safari.*version/i,
    /x-requested-with/i,
  ];
  const hasWebViewPattern = webViewPatterns.some((pattern) =>
    pattern.test(userAgent) || (getHeader ? pattern.test(getHeader("X-Requested-With") || "") : false)
  );

  // Mobile frameworks
  const mobileAppFrameworks = [
    "cordova",
    "phonegap",
    "ionic",
    "capacitor",
    "react-native",
    "flutter",
    "xamarin",
  ];
  const isMobileAppFramework = mobileAppFrameworks.some((framework) =>
    userAgentLower.includes(framework)
  );

  return (
    hasWebViewHeaders ||
    isAndroidWebView ||
    isIOSWebView ||
    hasWebViewPattern ||
    isMobileAppFramework
  );
}

/**
 * Check if the request is coming from a WebView (server-side)
 */
export function isWebView(userAgent: string, headers: Headers): boolean {
  return detectWebView(userAgent, (name) => headers.get(name));
}

/**
 * Check if the request is from a specific app's WebView
 * @param userAgent - The user agent string from the request
 * @param headers - Request headers object
 * @param appIdentifier - Optional app identifier to check for
 * @returns boolean indicating if the request is from the specified app's WebView
 */
export function isAppWebView(
  userAgent: string,
  headers: Headers,
  appIdentifier?: string
): boolean {
  if (!isWebView(userAgent, headers)) {
    return false;
  }

  // If no specific app identifier is provided, return true for any WebView
  if (!appIdentifier) {
    return true;
  }

  // Check for app-specific identifier in user agent or headers
  const userAgentLower = userAgent.toLowerCase();
  const appIdentifierLower = appIdentifier.toLowerCase();

  return (
    userAgentLower.includes(appIdentifierLower) ||
    headers.get("X-App-Name")?.toLowerCase() === appIdentifierLower ||
    (headers.get("X-App-Version")?.includes(appIdentifier) ?? false)
  );
}

/**
 * Get WebView type from user agent
 * @param userAgent - The user agent string from the request
 * @returns string indicating the WebView type or 'unknown'
 */
export function getWebViewType(userAgent: string): string {
  if (!userAgent) return "unknown";

  const userAgentLower = userAgent.toLowerCase();

  if (userAgentLower.includes("android") && userAgentLower.includes("wv")) {
    return "android-webview";
  }

  if (userAgentLower.includes("iphone") || userAgentLower.includes("ipad")) {
    // Improved iOS WebView detection
    if (
      // WKWebView pattern - Safari without Version
      (userAgentLower.includes("safari") && !userAgentLower.includes("version")) ||
      // UIWebView pattern - has Version and Mobile
      (userAgentLower.includes("safari") && userAgentLower.includes("version") && userAgentLower.includes("mobile")) ||
      // App WebView without Safari string but has WebKit
      (!userAgentLower.includes("safari") && userAgentLower.includes("webkit")) ||
      // Generic iOS WebView patterns
      userAgentLower.includes("webview") ||
      // iOS app pattern - Mobile/ without Safari
      (userAgentLower.includes("mobile/") && !userAgentLower.includes("safari")) ||
      // WKWebView with custom user agent
      userAgentLower.includes("wkwebview") ||
      // Native app pattern
      (userAgentLower.includes("webkit") && !userAgentLower.includes("chrome") && !userAgentLower.includes("firefox"))
    ) {
      return "ios-webview";
    }
  }

  if (userAgentLower.includes("webview")) {
    return "generic-webview";
  }

  return "unknown";
}

/**
 * Check if the current browser is running in a WebView (client-side)
 */
export function isClientWebView(): boolean {
  if (typeof window === "undefined") return false;
  return detectWebView(navigator.userAgent);
}

/**
 * Open URL in external browser from WebView
 * @param url - The URL to open in external browser
 */
export function openInExternalBrowser(url: string): void {
  if (typeof window === "undefined") {
    return;
  }

  // Try different methods to open in external browser

  // Method 1: Try to use _blank with specific features
  try {
    const newWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (newWindow) {
      newWindow.focus();
      return;
    }
  } catch (e) {
    console.log("Method 1 failed:", e);
  }

  // Method 2: Try to create a link and click it
  try {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  } catch (e) {
    console.log("Method 2 failed:", e);
  }

  // Method 3: Direct window.location as fallback
  try {
    window.location.href = url;
  } catch (e) {
    console.log("Method 3 failed:", e);
  }
}

/**
 * Get WebView type from client-side
 * @returns string indicating the WebView type or 'browser'
 */
export function getClientWebViewType(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const userAgent = navigator.userAgent;
  const userAgentLower = userAgent.toLowerCase();

  if (userAgentLower.includes("android") && userAgentLower.includes("wv")) {
    return "android-webview";
  }

  if (userAgentLower.includes("iphone") || userAgentLower.includes("ipad")) {
    // Improved iOS WebView detection
    if (
      // WKWebView pattern - Safari without Version
      (userAgentLower.includes("safari") && !userAgentLower.includes("version")) ||
      // UIWebView pattern - has Version and Mobile
      (userAgentLower.includes("safari") && userAgentLower.includes("version") && userAgentLower.includes("mobile")) ||
      // App WebView without Safari string but has WebKit
      (!userAgentLower.includes("safari") && userAgentLower.includes("webkit")) ||
      // Generic iOS WebView patterns
      userAgentLower.includes("webview") ||
      // iOS app pattern - Mobile/ without Safari
      (userAgentLower.includes("mobile/") && !userAgentLower.includes("safari")) ||
      // WKWebView with custom user agent
      userAgentLower.includes("wkwebview") ||
      // Native app pattern
      (userAgentLower.includes("webkit") && !userAgentLower.includes("chrome") && !userAgentLower.includes("firefox"))
    ) {
      return "ios-webview";
    }
  }

  if (userAgentLower.includes("webview")) {
    return "generic-webview";
  }

  if (isClientWebView()) {
    return "unknown-webview";
  }

  return "browser";
}
