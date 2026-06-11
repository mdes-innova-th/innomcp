import type { Metadata } from "next";
import { Chakra_Petch, Sarabun } from "next/font/google";
import "@/app/styles/globals.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { getNonce } from "@/utils/nonce";
import "dotenv/config";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "@/app/context/ThemeContext";
import { ToastProvider } from "@/app/context/ToastContext";
import Header from "@/app/components/Header";
import ModeStatusBar from "@/app/components/ModeStatusBar";
import GlobalLoadingOverlay from "@/app/components/common/GlobalLoadingOverlay";
import FooterWrapper from "@/app/components/FooterWrapper";
import MobileNav from "@/app/components/common/MobileNav";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";

// Prevent FontAwesome from adding its CSS since we are using Tailwind
config.autoAddCss = false;

// Force dynamic rendering for this layout to enable CSP nonces
export const dynamic = "force-dynamic";

const title = process.env.NEXT_PUBLIC_APPTITLE;

const sarabun = Sarabun({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ["latin", "thai"],
  variable: "--font-sarabun",
  display: 'swap',
});

const chakraPetch = Chakra_Petch({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "thai"],
  variable: "--font-chakra-petch",
  display: "swap",
});

export const metadata: Metadata = {
  title: title || 'INNOMCP — ศูนย์ MCP ภาครัฐ',
  description: 'ระบบ AI สำหรับภาครัฐไทย โดย MDES — Multi-Agent Chat ด้วย MDES Ollama',
  themeColor: '#1a3c6e',
  openGraph: {
    title: 'INNOMCP — ศูนย์ MCP ภาครัฐ',
    siteName: 'INNOMCP',
    locale: 'th_TH',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getNonce();
  const logMode = process.env.LOG_MODE || 'dev';

  return (
    <html lang="th" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* CSP nonce is available for external scripts if needed */}
        {nonce && <meta name="csp-nonce" content={nonce} />}
        {/* Prevent theme flash (FOUC) - Load theme BEFORE React hydration */}
        <script
          suppressHydrationWarning
          nonce={nonce || undefined}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || theme === 'light') {
                    document.documentElement.classList.add(theme);
                    document.documentElement.setAttribute('data-theme', theme);
                    // 🔥 2026 FIX: Also add to body for better compatibility
                    document.body?.classList.add(theme);
                  } else {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var initialTheme = prefersDark ? 'dark' : 'light';
                    document.documentElement.classList.add(initialTheme);
                    document.documentElement.setAttribute('data-theme', initialTheme);
                    document.body?.classList.add(initialTheme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Inject LOG_MODE for client logger */}
        <script
          suppressHydrationWarning
          nonce={nonce || undefined}
          dangerouslySetInnerHTML={{
            __html: `window.__INNOMCP_LOG_MODE__ = '${logMode}';`,
          }}
        />
        {/* Font Awesome (used for inline icons like fa-exclamation-circle) */}
        {/* Note: External stylesheets don't need nonce, only inline styles do */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"
        />
      </head>
      <body
        className={`${sarabun.variable} ${chakraPetch.variable} ${sarabun.className} antialiased flex flex-col min-h-screen bg-background text-foreground`}
      >
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <Header />
              <ModeStatusBar />
              <GlobalLoadingOverlay />
              <main className="relative flex-1 pt-24 pb-16 md:pb-0">
                {children}
              </main>
              <FooterWrapper />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
        <MobileNav />
      </body>
    </html>
  );
}
