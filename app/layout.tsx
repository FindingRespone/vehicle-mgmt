import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "众投物流车辆管理系统",
  description: "车辆管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">{children}</body>
    </html>
  );
}
