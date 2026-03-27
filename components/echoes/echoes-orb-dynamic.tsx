import dynamic from "next/dynamic";

export const EchoesOrbDynamic = dynamic(
  () => import("./echoes-orb").then((m) => ({ default: m.EchoesOrb })),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-48 animate-pulse rounded-full border border-[rgba(124,92,191,0.3)]" />
    ),
  },
);
