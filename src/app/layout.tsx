import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ANOA - Trustless AI Agents on Monad",
  description: "Deploy autonomous trading agents with verifiable on-chain execution. Built with ERC-8004 standard for transparent, accountable AI operations in DeFi.",
  keywords: ["AI", "DeFi", "Monad", "Trading", "Agents", "ERC-8004", "Blockchain", "x402", "A2A", "OpenClaw", "ANOA", "agent0", "autonomous agents", "trustless AI", "smart contracts", "crypto trading"],
  authors: [{ name: "ANOA Team" }],
  openGraph: {
    title: "ANOA - Trustless AI Agents on Monad",
    description: "Deploy autonomous trading agents with verifiable on-chain execution.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ANOA - Trustless AI Agents on Monad",
    description: "Deploy autonomous trading agents with verifiable on-chain execution.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
