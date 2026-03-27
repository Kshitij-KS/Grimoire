import { notFound, redirect } from "next/navigation";
import { getDemoData, getSessionUser, getWorldWorkspaceData } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/env";
import { WORLD_SECTIONS } from "@/lib/constants";
import { WorldWorkspace } from "@/components/worlds/world-workspace";

export default async function WorldPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { section?: string };
}) {
  const user = await getSessionUser();

  if (hasSupabaseEnv() && !user) {
    redirect("/auth");
  }

  const section = WORLD_SECTIONS.includes((searchParams.section as typeof WORLD_SECTIONS[number]) ?? "lore")
    ? (searchParams.section as typeof WORLD_SECTIONS[number])
    : "lore";

  const data = await getWorldWorkspaceData(params.id, section, false);

  if (!data) return notFound();

  return <WorldWorkspace data={data} checks={(await getDemoData()).checks} />;
}
