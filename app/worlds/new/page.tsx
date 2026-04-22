import { redirect } from "next/navigation";
import { WorldCreationFlow } from "@/components/worlds/world-creation-flow";
import { getSessionUser } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/public-env";

export default async function NewWorldPage() {
  const user = await getSessionUser();

  if (hasSupabaseEnv() && !user) {
    redirect("/auth");
  }

  return (
    <main className="page-fade flex min-h-screen items-center justify-center px-6 py-10">
      <WorldCreationFlow />
    </main>
  );
}
