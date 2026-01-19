import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "@/app/styles/globals.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { getNonce } from "@/utils/nonce";
import "dotenv/config";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "@/app/context/ThemeContext";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
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

export const metadata: Metadata = {
  title: title,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getNonce();
  const logMode = process.env.LOG_MODE || 'dev';

  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* CSP nonce is available for external scripts if needed */}
        {nonce && <meta name="csp-nonce" content={nonce} />}
        {/* Inject LOG_MODE for client logger */}
        <script
          nonce={nonce}
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
        className={`${sarabun.variable} ${sarabun.className} antialiased flex flex-col min-h-screen bg-background text-foreground`}
      >
        <AuthProvider>
          <ThemeProvider>
            <Header />
            <main className="flex-1 pt-24 pb-8">{children}</main>
            <Footer />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
