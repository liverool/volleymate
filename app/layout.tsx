import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import TopNav from "./components/TopNav";
import UserMenu from "./components/UserMenu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Volleymate",
  description: "Finn folk å spille med",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          background: "var(--vm-bg)",
          color: "var(--vm-text)",
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "var(--vm-bg)",
            borderBottom: "1px solid var(--vm-border)",
          }}
        >
          <div
            style={{
              maxWidth: 1200,         // litt bredere, så menyen får plass
              margin: "0 auto",
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {/* Venstre: Hjem */}
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 900,
                textDecoration: "none",
                color: "var(--vm-text)",
                whiteSpace: "nowrap",
              }}
            >
              🏐 Volleymate
            </Link>

            {/* Midten: Nav */}
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <TopNav />
            </div>

            {/* Høyre: User menu */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <UserMenu />
            </div>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
