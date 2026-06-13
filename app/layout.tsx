import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cleveland Neighborhoods — Enrichment (Staff)",
  description: "Library-facing enrichment interface and scan pipeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Literal font-family names are referenced from STAFF_TOKENS (CSS-in-JS),
            so load the families by name via <link> rather than next/font (which hashes them). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600&family=Work+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
