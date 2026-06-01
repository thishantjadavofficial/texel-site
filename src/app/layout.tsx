import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Texel | Immersive B2B Textile Marketplace",
  description: "Bridges global freelance designers and Indian manufacturing mills with secure IP print-lock protection, infinite canvas rapport viewer, and Equal Sacrifice dynamic volume discounts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0c] text-white antialiased">{children}</body>
    </html>
  );
}
