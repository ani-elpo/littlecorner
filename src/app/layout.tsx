import type { Metadata } from "next";
import { Special_Elite, Lora, Caveat } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const display = Special_Elite({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const body = Lora({
  variable: "--font-body",
  subsets: ["latin"],
});

const handwritten = Caveat({
  variable: "--font-handwritten",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Our Little Corner",
  description: "A private little corner of the internet, just for us.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${display.variable} ${body.variable} ${handwritten.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col corkboard">{children}</body>
      </html>
    </ClerkProvider>
  );
}
