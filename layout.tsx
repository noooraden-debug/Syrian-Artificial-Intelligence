import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "دردشة الذكاء الاصطناعي في سوريا",
  description: "منصة دردشة عربية مع اشتراكات Pro وأكواد شحن وتجربة ذكية متقدمة.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#050816] text-white antialiased">{children}</body>
    </html>
  );
}
