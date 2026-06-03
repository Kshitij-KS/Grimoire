import type { Metadata } from "next";
import { WorldWorkspace } from "@/components/worlds/world-workspace";
import { getDemoData, getWorldWorkspaceData } from "@/lib/data";

const BASE_URL = "https://grimoire.pro";

export const metadata: Metadata = {
  title: "Ashveil Demo — Grimoire Worldbuilding Studio",
  description:
    "Explore Ashveil, a fully-realized demo world showcasing AI lore management, entity extraction, and character souls in Grimoire.",
  openGraph: {
    title: "Explore Ashveil — Grimoire Demo World",
    description:
      "Explore Ashveil, a fully-realized demo world showcasing AI lore management, entity extraction, and character souls in Grimoire.",
    url: `${BASE_URL}/demo`,
    siteName: "Grimoire",
    images: [
      {
        url: `${BASE_URL}/og-demo.png`,
        width: 1200,
        height: 630,
        alt: "Ashveil Demo World — Grimoire",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore Ashveil — Grimoire Demo World",
    description:
      "Explore Ashveil, a fully-realized demo world showcasing AI lore management, entity extraction, and character souls in Grimoire.",
    images: [`${BASE_URL}/og-demo.png`],
  },
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: { section?: string };
}) {
  const section = (searchParams.section as "lore" | "bible" | "souls" | "consistency") ?? "lore";
  const data = await getWorldWorkspaceData("demo-world", section, true);
  const demo = await getDemoData();

  if (!data) return null;

  return <WorldWorkspace data={data} checks={demo.checks} />;
}
