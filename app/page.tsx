import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

const BASE_URL = "https://grimoire.pro";

export const metadata: Metadata = {
  title: "Grimoire — AI Worldbuilding Studio",
  description:
    "Build rich fantasy worlds with AI-powered lore management, living world bibles, character souls, and consistency checking.",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "Grimoire — AI Worldbuilding Studio",
    description:
      "Build rich fantasy worlds with AI-powered lore management, living world bibles, character souls, and consistency checking.",
    url: BASE_URL,
    siteName: "Grimoire",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Grimoire — AI Worldbuilding Studio",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Grimoire — AI Worldbuilding Studio",
    description:
      "Build rich fantasy worlds with AI-powered lore management, living world bibles, character souls, and consistency checking.",
    images: [`${BASE_URL}/og-image.png`],
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Grimoire",
              url: BASE_URL,
            },
            {
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Grimoire",
              url: BASE_URL,
              applicationCategory: "Entertainment",
            },
          ]),
        }}
      />
      <LandingPage />
    </>
  );
}
