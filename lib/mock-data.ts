import type {
  ConsistencyCheck,
  ConsistencyFlag,
  Entity,
  LoreEntry,
  Soul,
  SoulCardData,
  UsageMeter,
  World,
  WorldStats,
} from "@/lib/types";

export const demoSoulCard: SoulCardData = {
  voice:
    "Mira speaks like a blade being drawn: measured, quiet, and more dangerous for how little she wastes. She hides tenderness behind dry wit and ritual precision.",
  core:
    "She is built from loyalty that curdled into guilt. Every choice she makes is a negotiation between control and the fear of becoming monstrous again.",
  knows: [
    "How the Ember Cult marked its inner sanctums with ash-salt sigils.",
    "Which bridges into Ashveil can be watched without being seen.",
    "The true cost of binding a lantern spirit.",
    "Why the western bells of the cathedral have been silent for nine winters.",
    "Who still carries the old emperor's cipher key.",
  ],
  doesnt_know: [
    "Who betrayed her during the Night of Hollow Glass.",
    "That the archmage's heir still lives.",
    "How much of her own memory was altered by oath magic.",
  ],
  relationships: [
    { name: "Brother Cael", attitude: "Protective, but distrustful of his certainty." },
    { name: "The Ember Cult", attitude: "Haunted by them and furious at herself for missing their rot." },
    { name: "The city of Ashveil", attitude: "Loves it like a wound that never closed." },
  ],
  secrets: [
    "She once executed an innocent courier to preserve a false prophecy.",
    "Her left hand still burns whenever a cult rite is spoken nearby.",
  ],
  sample_lines: [
    "If you want the truth, ask softly. It startles less that way.",
    "Cities die twice: once in flame, once when people begin speaking of them in the past tense.",
    "I know the ritual. I said I hated it, not that I forgot it.",
  ],
};

export const demoWorld: World = {
  id: "demo-world",
  user_id: null,
  name: "Ashveil",
  genre: "Fantasy",
  tone: "Dark & Gritty",
  premise:
    "A dying empire clings to its final magical city while old cults, forbidden oaths, and living relics begin to wake.",
  cover_color: "#7c5cbf",
  is_demo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const demoLoreEntries: LoreEntry[] = [
  {
    id: "lore-1",
    world_id: demoWorld.id,
    user_id: null,
    title: "The Ashveil Compact",
    content:
      "Ashveil was never meant to survive the empire. Its walls endure because seven archmages bound their names into the city's foundation, turning memory itself into mortar. Citizens speak carefully around the eastern wards, because names said too often begin to answer back.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "lore-2",
    world_id: demoWorld.id,
    user_id: null,
    title: "Mira Ashveil",
    content:
      "Mira is a former cult enforcer who deserted after the Night of Hollow Glass. She knows the hidden staircases under Ember Bridge, carries a lantern that refuses holy fire, and distrusts anyone who smiles before sunset.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const demoEntities: Entity[] = [
  {
    id: "entity-1",
    world_id: demoWorld.id,
    name: "Mira Ashveil",
    type: "character",
    summary:
      "A former cult enforcer turned reluctant protector, Mira moves through Ashveil with practiced caution and buried guilt.",
    first_mentioned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    mention_count: 4,
  },
  {
    id: "entity-2",
    world_id: demoWorld.id,
    name: "Ember Bridge",
    type: "location",
    summary:
      "A soot-veined bridge and ritual crossing point whose hidden stairs are known only to smugglers, cultists, and survivors.",
    first_mentioned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    mention_count: 3,
  },
  {
    id: "entity-3",
    world_id: demoWorld.id,
    name: "Ember Cult",
    type: "faction",
    summary:
      "A secretive order that wrapped civic ritual in fire-lit obedience and left scars across the city when it fractured.",
    first_mentioned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    mention_count: 6,
  },
];

export const demoSouls: Soul[] = [
  {
    id: "soul-1",
    world_id: demoWorld.id,
    user_id: null,
    name: "Mira Ashveil",
    description:
      "Former cult enforcer, now a wary protector of Ashveil with a talent for rituals she wishes she could forget.",
    soul_card: demoSoulCard,
    avatar_color: "#7c5cbf",
    avatar_initials: "MA",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const demoFlags: ConsistencyFlag[] = [
  {
    id: "flag-1",
    world_id: demoWorld.id,
    check_id: "check-1",
    flagged_text: "The cathedral bells rang throughout the siege.",
    contradiction: "Earlier lore states the western bells have been silent for nine winters.",
    existing_reference:
      "The cathedral's western bells have not answered a hand or storm in nine winters.",
    severity: "medium",
    resolved: false,
    created_at: new Date().toISOString(),
  },
];

export const demoChecks: ConsistencyCheck[] = [
  {
    id: "check-1",
    world_id: demoWorld.id,
    user_id: null,
    source_text: "The cathedral bells rang throughout the siege.",
    created_at: new Date().toISOString(),
  },
];

export const demoUsage: UsageMeter[] = [
  { action: "chat_message", count: 12, limit: 50 },
  { action: "lore_ingest", count: 2, limit: 10 },
  { action: "consistency_check", count: 1, limit: 5 },
  { action: "soul_generate", count: 1, limit: 3 },
];

export const demoStats: WorldStats = {
  loreEntries: demoLoreEntries.length,
  souls: demoSouls.length,
  contradictions: demoFlags.length,
  totalWords: demoLoreEntries.reduce(
    (total, entry) => total + entry.content.split(/\s+/).filter(Boolean).length,
    0,
  ),
};
