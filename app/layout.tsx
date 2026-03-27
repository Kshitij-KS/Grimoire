import type { Metadata } from "next";
import { Crimson_Pro, Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { AetherBackground } from "@/components/aether/aether-background";
import { AmbientAudioProvider } from "@/components/shared/ambient-audio";

const crimson = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-crimson",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grimoire — Worldbuilding Studio",
  description:
    "A premium dark fantasy worldbuilding studio for lore, living world bibles, AI character souls, and interactive timelines.",
  keywords: ["worldbuilding", "writing", "AI", "fantasy", "lore", "fiction"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${crimson.variable} ${inter.variable} antialiased`}>
        <AetherBackground />
        <AppProviders>
          <AmbientAudioProvider />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
