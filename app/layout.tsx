import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Shorts Generator",
  description: "Convert YouTube videos into local AI-generated Shorts, TikToks, and Reels."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
