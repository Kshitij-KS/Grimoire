import { WorldWorkspace } from "@/components/worlds/world-workspace";
import { getDemoData, getWorldWorkspaceData } from "@/lib/data";

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
