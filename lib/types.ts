import type { WorldSection } from "@/lib/constants";

export type PlanTier = "free" | "pro";
export type MemberRole = "owner" | "editor" | "viewer";
export type EntityType =
  | "character"
  | "location"
  | "faction"
  | "artifact"
  | "event"
  | "rule";
export type Severity = "low" | "medium" | "high";
export type ProcessingStatus = "pending" | "processing" | "complete" | "failed";
export type FailedJobStatus = "failed" | "retrying" | "resolved";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  plan: PlanTier;
  created_at: string;
}

export interface World {
  id: string;
  user_id: string | null;
  name: string;
  genre: string | null;
  tone: string | null;
  premise: string | null;
  cover_color: string;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoreEntry {
  id: string;
  world_id: string;
  user_id: string | null;
  content: string;
  title: string | null;
  folder_id?: string | null;
  processing_status?: ProcessingStatus;
  inngest_event_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface LoreChunk {
  id: string;
  world_id: string;
  lore_entry_id: string;
  content: string;
  entity_tags: string[] | null;
  chunk_index: number;
  created_at: string;
}

export interface Entity {
  id: string;
  world_id: string;
  name: string;
  type: EntityType;
  summary: string | null;
  first_mentioned_at: string;
  updated_at: string;
  mention_count?: number;
  lore_chunks?: LoreChunk[];
}

export interface SoulRelationship {
  name: string;
  attitude: string;
}

export interface SoulCardData {
  voice: string;
  core: string;
  knows: string[];
  doesnt_know: string[];
  relationships: SoulRelationship[];
  secrets: string[];
  sample_lines: string[];
}

export interface Soul {
  id: string;
  world_id: string;
  user_id: string | null;
  name: string;
  description: string;
  soul_card: SoulCardData | null;
  avatar_color: string;
  avatar_initials: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  soul_id: string;
  user_id: string;
  world_id: string;
  compressed_history: string | null;
  created_at: string;
  last_active: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  source_chunk_ids?: string[] | null;
  created_at: string;
}

export interface ConsistencyCheck {
  id: string;
  world_id: string;
  user_id: string | null;
  source_text: string;
  created_at: string;
}

export interface ConsistencyFlag {
  id: string;
  world_id: string;
  check_id: string | null;
  flagged_text: string;
  contradiction: string;
  existing_reference: string | null;
  severity: Severity;
  resolved: boolean;
  created_at: string;
}

// ── New types for feature expansion ─────────────────────────────────────

export interface FailedJob {
  id: string;
  user_id: string;
  world_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  status: FailedJobStatus;
  lore_entry_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface SemanticCacheEntry {
  id: string;
  world_id: string;
  soul_id: string;
  prompt_hash: string;
  prompt_text: string;
  response: string;
  hit_count: number;
  created_at: string;
}

export interface LoreFolder {
  id: string;
  world_id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  children?: LoreFolder[];
}

export interface EntityRelationship {
  id: string;
  world_id: string;
  user_id: string | null;
  source_entity_id: string;
  target_entity_id: string;
  label: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  source_entity?: Entity;
  target_entity?: Entity;
}

export interface TavernSession {
  id: string;
  world_id: string;
  user_id: string;
  name: string;
  soul_ids: string[];
  created_at: string;
  last_active: string;
  souls?: Soul[];
}

export interface TavernMessage {
  id: string;
  session_id: string;
  soul_id: string | null;
  role: "user" | "director" | "soul";
  directed_to: string | null;
  content: string;
  created_at: string;
  soul?: Soul;
}

// ── Composite types ─────────────────────────────────────────────────────

export interface WorldStats {
  loreEntries: number;
  souls: number;
  contradictions: number;
  totalWords: number;
  entities?: number;
  folders?: number;
}

export interface UsageMeter {
  action: keyof typeof import("./constants").DAILY_LIMITS;
  count: number;
  limit: number;
}

export interface WorldWorkspaceData {
  world: World;
  stats: WorldStats;
  usage: UsageMeter[];
  loreEntries: LoreEntry[];
  entities: Entity[];
  souls: Soul[];
  flags: ConsistencyFlag[];
  folders: LoreFolder[];
  relationships: EntityRelationship[];
  activeSection: WorldSection;
  isReadonly?: boolean;
  memberRole?: MemberRole;
}

export interface DashboardData {
  worlds: World[];
  profile: Profile;
  recentActivity: ActivityItem[];
  globalStats: {
    totalWorlds: number;
    totalLore: number;
    totalSouls: number;
    totalEntities: number;
  };
}

// ── Collaboration types ──────────────────────────────────────────────────

export interface WorldMember {
  id: string;
  world_id: string;
  user_id: string;
  role: MemberRole;
  invited_by: string | null;
  joined_at: string;
  profile?: Profile;
}

export interface WorldInvitation {
  id: string;
  world_id: string;
  invited_email: string;
  role: MemberRole;
  token: string;
  created_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  type: "lore_created" | "soul_forged" | "consistency_check" | "chat_message" | "entity_discovered";
  title: string;
  description: string;
  world_id: string;
  world_name: string;
  created_at: string;
}
