import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "САПР ПГС — Строительная механика и Сопромат",
  description: "Интерактивный расчет балок, рам, ступенчатых стержней и валов",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="antialiased bg-[#F3F4F6] text-[#1F2937]">{children}</body>
    </html>
  );
}