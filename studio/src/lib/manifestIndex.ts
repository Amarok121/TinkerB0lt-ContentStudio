import type { ContentManifest, ContentRef, EntityRow } from "./contentClient";

export type EntityKind = keyof ContentManifest["entities"];

export const NARRATIVE_KINDS: EntityKind[] = [
  "quests",
  "events",
  "dialogues",
  "flags",
];

export const ALL_ENTITY_KINDS: EntityKind[] = [
  ...NARRATIVE_KINDS,
  "enemies",
  "items",
];

export const KIND_LABELS: Record<EntityKind, string> = {
  quests: "Quest",
  events: "Event",
  dialogues: "Dialogue",
  flags: "Flag",
  enemies: "Enemy",
  items: "Item",
};

const ID_PREFIX_TO_KIND: Record<string, EntityKind> = {
  quest: "quests",
  event: "events",
  dialogue: "dialogues",
  flag: "flags",
  enemy: "enemies",
  item: "items",
};

export interface ManifestEntity {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle?: string;
  path?: string;
  row: EntityRow;
}

export interface RefIndex {
  outgoing: Map<string, ContentRef[]>;
  incoming: Map<string, ContentRef[]>;
}

export function entityKindFromId(id: string): EntityKind | null {
  const prefix = id.split(":")[0] ?? "";
  return ID_PREFIX_TO_KIND[prefix] ?? null;
}

export function displayTitle(row: EntityRow): string {
  if (row.title?.trim()) return row.title.trim();
  if (row.label?.trim()) return row.label.trim();
  if (row.name?.trim()) return row.name.trim();
  if (row.name_en?.trim()) return row.name_en.trim();
  if (row.name_ko?.trim()) return row.name_ko.trim();
  return row.id;
}

export function flattenManifestEntities(manifest: ContentManifest): ManifestEntity[] {
  const result: ManifestEntity[] = [];
  for (const kind of ALL_ENTITY_KINDS) {
    for (const row of manifest.entities[kind] ?? []) {
      if (!row.id) continue;
      const path = row.path?.trim();
      result.push({
        id: row.id,
        kind,
        title: displayTitle(row),
        subtitle: path || row.name_ko?.trim() || undefined,
        path,
        row,
      });
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildRefIndex(refs: ContentRef[]): RefIndex {
  const outgoing = new Map<string, ContentRef[]>();
  const incoming = new Map<string, ContentRef[]>();
  for (const ref of refs) {
    if (!outgoing.has(ref.from)) outgoing.set(ref.from, []);
    outgoing.get(ref.from)!.push(ref);
    if (!incoming.has(ref.to)) incoming.set(ref.to, []);
    incoming.get(ref.to)!.push(ref);
  }
  return { outgoing, incoming };
}

/** Outgoing refs for an entity id, optionally including its step ids. */
export function refsOutgoing(
  contextId: string,
  index: RefIndex,
  includeChildSteps = true
): ContentRef[] {
  const seen = new Set<string>();
  const result: ContentRef[] = [];

  function add(key: string) {
    for (const ref of index.outgoing.get(key) ?? []) {
      const sig = `${ref.from}|${ref.type}|${ref.to}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      result.push(ref);
    }
  }

  add(contextId);
  if (includeChildSteps) {
    for (const [from] of index.outgoing) {
      if (from.startsWith(`${contextId}:`)) add(from);
    }
  }

  return result.sort((a, b) => a.type.localeCompare(b.type) || a.to.localeCompare(b.to));
}

export function refsIncoming(contextId: string, index: RefIndex): ContentRef[] {
  return [...(index.incoming.get(contextId) ?? [])].sort(
    (a, b) => a.type.localeCompare(b.type) || a.from.localeCompare(b.from)
  );
}

export function findEntity(
  entities: ManifestEntity[],
  id: string
): ManifestEntity | undefined {
  return entities.find((e) => e.id === id);
}

export function filterEntities(
  entities: ManifestEntity[],
  opts: { kind: EntityKind | "all"; query: string }
): ManifestEntity[] {
  const q = opts.query.trim().toLowerCase();
  return entities.filter((entity) => {
    if (opts.kind !== "all" && entity.kind !== opts.kind) return false;
    if (!q) return true;
    return (
      entity.id.toLowerCase().includes(q) ||
      entity.title.toLowerCase().includes(q) ||
      (entity.subtitle?.toLowerCase().includes(q) ?? false) ||
      (entity.path?.toLowerCase().includes(q) ?? false)
    );
  });
}

export const REF_TYPE_LABELS: Record<string, string> = {
  sets_flag: "Sets flag",
  requires_flag: "Requires flag",
  updates_quest: "Updates quest",
  updates_event: "Updates event",
  rewards_item: "Rewards item",
  starts_dialogue: "Starts dialogue",
};

export function refTypeLabel(type: string): string {
  return REF_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}
