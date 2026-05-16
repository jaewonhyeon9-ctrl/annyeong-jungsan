import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "BeautyChain — 뷰티센터 다지점 정산",
  description: "다중 지점 뷰티/메디컬 센터 매출 · 환자 · 정산 통합 관리",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-sand-50 text-ink antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
