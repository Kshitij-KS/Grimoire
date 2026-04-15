export const dynamic = "force-dynamic";
import JSZip from "jszip";
import { requireUser, jsonError } from "@/lib/api";

function safeFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "_").replace(/^_+|_+$/g, "") || "world";
}

// ── Markdown helpers ────────────────────────────────────────────────────────

function mdMeta(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return `**${key}:** ${String(value)}\n`;
}

function buildReadme(world: Record<string, unknown>): string {
  return [
    `# ${world.name}`,
    "",
    mdMeta("Genre", world.genre),
    mdMeta("Tone", world.tone),
    world.premise ? `## Premise\n\n${world.premise}\n` : "",
    mdMeta("Created", world.created_at),
    mdMeta("Last updated", world.updated_at),
    "",
    "_Exported from Grimoire — your enchanted worldbuilding tome._",
  ].filter((l) => l !== undefined).join("\n");
}

function buildLoreEntryMd(entry: Record<string, unknown>): string {
  const lines: string[] = [
    `# ${entry.title ?? "Untitled"}`,
    "",
    mdMeta("Created", entry.created_at),
    mdMeta("Folder", entry.folder_id ?? "Root"),
    "",
    "---",
    "",
    String(entry.content ?? ""),
  ];
  return lines.join("\n");
}

function buildEntitySectionMd(
  type: string,
  entities: Array<Record<string, unknown>>,
  relationships: Array<Record<string, unknown>>,
): string {
  const filtered = entities.filter((e) => e.type === type);
  if (filtered.length === 0) return "";
  const typeTitle = type.charAt(0).toUpperCase() + type.slice(1) + "s";
  const lines: string[] = [`# ${typeTitle}`, ""];
  for (const e of filtered) {
    lines.push(`## ${e.name}`);
    if (e.summary) lines.push("", String(e.summary));
    if ((e.mention_count as number) > 0) lines.push("", `*Mentioned ${e.mention_count} times in lore.*`);
    // Relationships
    const rels = relationships.filter(
      (r) => r.source_entity_id === e.id || r.target_entity_id === e.id,
    );
    if (rels.length > 0) {
      lines.push("", "**Connections:**");
      for (const r of rels) {
        const isSource = r.source_entity_id === e.id;
        const otherId = isSource ? r.target_entity_id : r.source_entity_id;
        const otherEntity = entities.find((x) => x.id === otherId);
        if (otherEntity) {
          lines.push(`- ${isSource ? "→" : "←"} **${r.label ?? "related to"}** ${otherEntity.name}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildSoulMd(soul: Record<string, unknown>): string {
  const card = soul.soul_card as Record<string, unknown> | null;
  const lines: string[] = [
    `# ${soul.name}`,
    "",
    mdMeta("Created", soul.created_at),
  ];
  if (soul.description) lines.push("", String(soul.description));
  if (card) {
    if (card.voice) lines.push("", `**Voice:** ${card.voice}`);
    if (card.core) lines.push("", `**Core:** ${card.core}`);
    if (Array.isArray(card.knows) && card.knows.length > 0) {
      lines.push("", "**Knows:**", ...card.knows.map((k: unknown) => `- ${k}`));
    }
    if (Array.isArray(card.doesnt_know) && card.doesnt_know.length > 0) {
      lines.push("", "**Doesn't know:**", ...card.doesnt_know.map((k: unknown) => `- ${k}`));
    }
    if (Array.isArray(card.secrets) && card.secrets.length > 0) {
      lines.push("", "**Secrets:**", ...card.secrets.map((s: unknown) => `- ${s}`));
    }
    if (Array.isArray(card.sample_lines) && card.sample_lines.length > 0) {
      lines.push("", "**Sample lines:**", ...card.sample_lines.map((l: unknown) => `> ${l}`));
    }
  }
  return lines.join("\n");
}

async function buildMarkdownZip(
  world: Record<string, unknown>,
  loreEntries: Array<Record<string, unknown>>,
  entities: Array<Record<string, unknown>>,
  relationships: Array<Record<string, unknown>>,
  souls: Array<Record<string, unknown>>,
): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("README.md", buildReadme(world));

  // Lore entries
  const loreFolder = zip.folder("lore")!;
  for (const entry of loreEntries) {
    const slug = safeFileName(String(entry.title ?? "untitled"));
    const safe = `${slug}_${(entry.id as string).slice(0, 8)}.md`;
    loreFolder.file(safe, buildLoreEntryMd(entry));
  }

  // Archive — one file per entity type
  const archiveFolder = zip.folder("archive")!;
  for (const type of ["character", "location", "faction", "artifact", "event", "rule"]) {
    const content = buildEntitySectionMd(type, entities, relationships);
    if (content) archiveFolder.file(`${type}s.md`, content);
  }

  // Souls
  const soulsFolder = zip.folder("souls")!;
  for (const soul of souls) {
    const slug = safeFileName(String(soul.name ?? "soul"));
    const safe = `${slug}_${(soul.id as string).slice(0, 8)}.md`;
    soulsFolder.file(safe, buildSoulMd(soul));
  }

  const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return buffer;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: world } = await supabase
    .from("worlds")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id && !world.is_demo) {
    return jsonError("Forbidden", 403);
  }

  const [
    { data: souls },
    { data: entities },
    { data: loreEntries },
    { data: loreFolders },
    { data: relationships },
    { data: checks },
    { data: flags },
    { data: tavernSessions },
    { data: tavernMessages },
    { data: conversations },
  ] = await Promise.all([
    supabase.from("souls").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("entities").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("lore_entries").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("lore_folders").select("*").eq("world_id", params.id).order("sort_order", { ascending: true }),
    supabase.from("entity_relationships").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("consistency_checks").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("consistency_flags").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("tavern_sessions").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("tavern_messages").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("conversations").select("*").eq("world_id", params.id).eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
  const { data: messages } = conversationIds.length > 0
    ? await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const exportData = {
    version: "2.0",
    exported_at: new Date().toISOString(),
    exported_by: user.id,
    world: {
      id: world.id,
      name: world.name,
      genre: world.genre,
      tone: world.tone,
      premise: world.premise,
      created_at: world.created_at,
      updated_at: world.updated_at,
      is_demo: Boolean(world.is_demo),
    },
    lore: {
      folders: (loreFolders ?? []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        parent_id: folder.parent_id,
        sort_order: folder.sort_order,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
      })),
      entries: (loreEntries ?? []).map((entry) => ({
        id: entry.id,
        title: entry.title,
        folder_id: entry.folder_id ?? null,
        content: entry.content,
        processing_status: entry.processing_status ?? null,
        created_at: entry.created_at,
        updated_at: entry.updated_at ?? null,
      })),
    },
    archive: {
      entities: (entities ?? []).map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        summary: entity.summary,
        mention_count: entity.mention_count ?? null,
        created_at: entity.created_at ?? null,
        updated_at: entity.updated_at ?? null,
      })),
      relationships: relationships ?? [],
    },
    souls: (souls ?? []).map((soul) => ({
      id: soul.id,
      name: soul.name,
      description: soul.description,
      avatar_color: soul.avatar_color,
      avatar_initials: soul.avatar_initials,
      is_active: soul.is_active,
      soul_card: soul.soul_card,
      created_at: soul.created_at,
      updated_at: soul.updated_at,
    })),
    consistency: {
      checks: checks ?? [],
      flags: flags ?? [],
    },
    tavern: {
      sessions: tavernSessions ?? [],
      messages: tavernMessages ?? [],
    },
    direct_chat: {
      conversations: conversations ?? [],
      messages: messages ?? [],
    },
  };

  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format === "markdown") {
    const zipBuffer = await buildMarkdownZip(
      exportData.world as Record<string, unknown>,
      (loreEntries ?? []) as Array<Record<string, unknown>>,
      (entities ?? []) as Array<Record<string, unknown>>,
      (relationships ?? []) as Array<Record<string, unknown>>,
      (souls ?? []) as Array<Record<string, unknown>>,
    );
    return new Response(zipBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="grimoire_export_${safeFileName(world.name)}.zip"`,
      },
    });
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="grimoire_export_${safeFileName(world.name)}.json"`,
    },
  });
}
