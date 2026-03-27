export const DAILY_LIMITS = {
  chat_message: 50,
  lore_ingest: 10,
  consistency_check: 5,
  soul_generate: 3,
  tavern_message: 30,
} as const;

export const FREE_TIER_LIMITS = {
  worlds: 1,
  soulsPerWorld: 3,
  loreEntries: 50,
} as const;

export const WORLD_SECTIONS = [
  "lore",
  "bible",
  "souls",
  "consistency",
  "tapestry",
  "tavern",
  "narrator",
] as const;

export type WorldSection = (typeof WORLD_SECTIONS)[number];

export const SECTION_LABELS: Record<WorldSection, string> = {
  lore: "Lore Scribe",
  bible: "The Archive",
  souls: "Bound Souls",
  consistency: "Narrator's Eye",
  tapestry: "The Tapestry",
  tavern: "The Tavern",
  narrator: "Narrator's Tools",
};

export const SEMANTIC_CACHE_THRESHOLD = 0.98;
export const MAX_INNGEST_RETRIES = 3;
export const CHUNK_SIZE_WORDS = 400;
export const AUTOCOMPLETE_WORD_COUNT = 15;
