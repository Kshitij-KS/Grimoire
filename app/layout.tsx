import type { Metadata } from "next";
import { Crimson_Pro, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { PostHogProvider } from "@/components/providers/posthog-provider";
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
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  themeColor: "#0A0A0B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${crimson.variable} ${inter.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
        >
          <AetherBackground />
          <AppProviders>
            <PostHogProvider>
              <AmbientAudioProvider />
              {children}
            </PostHogProvider>
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
