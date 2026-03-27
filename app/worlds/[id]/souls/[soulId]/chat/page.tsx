import { notFound, redirect } from "next/navigation";
import { EchoesInterface } from "@/components/echoes/echoes-interface";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDemoData, getSessionUser } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/env";
import type { Message, Soul } from "@/lib/types";

export default async function SoulChatPage({
  params,
}: {
  params: { id: string; soulId: string };
}) {
  const isDemoWorld = params.id === "demo-world";

  if (!hasSupabaseEnv() || isDemoWorld) {
    const demo = await getDemoData();
    const soul = demo.souls.find((entry) => entry.id === params.soulId) ?? demo.souls[0];
    return <EchoesInterface soul={soul} worldId={demo.world.id} initialMessages={[]} remaining={38} isDemo />;
  }

  const user = await getSessionUser();
  if (!user) redirect("/auth");

  const supabase = createServerSupabaseClient();
  const [{ data: soul }, { data: conversation }] = await Promise.all([
    supabase.from("souls").select("*").eq("id", params.soulId).maybeSingle(),
    supabase.from("conversations").select("*").eq("soul_id", params.soulId).eq("user_id", user.id).maybeSingle(),
  ]);

  if (!soul) return notFound();

  let messages: Message[] = [];
  if (conversation) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    messages = (data ?? []) as Message[];
  }

  return <EchoesInterface soul={soul as Soul} worldId={params.id} initialMessages={messages} remaining={50} />;
}
