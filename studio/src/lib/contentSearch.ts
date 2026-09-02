import {
  contentFileUrl,
  fetchManifest,
  IS_DEMO_MODE,
  type ContentManifest,
  type EntityRow,
} from "./contentClient";
import {
  dialogueMatchesQuery,
  indexDialogueJson,
  type DialogueIndexEntry,
} from "./dialogueIndex";
import {
  ALL_ENTITY_KINDS,
  KIND_LABELS,
  displayTitle,
  type EntityKind,
} from "./manifestIndex";

export interface SearchHit {
  id: string;
  kind: EntityKind | "dialogue_file";
  title: string;
  snippet: string;
  path?: string;
  score: number;
}

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(contentFileUrl(path));
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function dialoguePathToFetch(path: string): string | null {
  if (IS_DEMO_MODE) return path;
  if (!path.startsWith("res://")) return null;
  return path.replace("res://", "");
}

function scoreMatch(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 80;
  if (lower.includes(q)) return 50;
  return 0;
}

function entityHits(row: EntityRow, kind: EntityKind, query: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const title = displayTitle(row);
  const fields = [
    row.id,
    title,
    row.path ?? "",
    row.label ?? "",
    row.name ?? "",
    row.name_en ?? "",
    row.name_ko ?? "",
  ];
  let best = 0;
  for (const f of fields) {
    best = Math.max(best, scoreMatch(f, query));
  }
  if (row.steps) {
    for (const step of row.steps) {
      best = Math.max(best, scoreMatch(step.id, query));
      best = Math.max(best, scoreMatch(step.title ?? "", query));
    }
  }
  if (best > 0) {
    hits.push({
      id: row.id,
      kind,
      title,
      snippet: row.path ?? row.id,
      path: row.path,
      score: best,
    });
  }
  return hits;
}

function dialogueFileHit(
  entry: DialogueIndexEntry,
  manifestId: string,
  query: string
): SearchHit | null {
  if (!dialogueMatchesQuery(entry, query)) return null;
  let best = scoreMatch(entry.dialogueId, query);
  best = Math.max(best, scoreMatch(entry.path, query));
  for (const s of entry.snippets) {
    best = Math.max(best, scoreMatch(s, query));
  }
  const snippet =
    entry.snippets.find((s) => s.toLowerCase().includes(query.toLowerCase())) ??
    entry.path;
  return {
    id: manifestId,
    kind: "dialogue_file",
    title: entry.dialogueId,
    snippet: snippet.slice(0, 120),
    path: entry.path,
    score: best,
  };
}

let cachedDialogues: Map<string, DialogueIndexEntry> | null = null;

async function loadDialogueIndex(manifest: ContentManifest): Promise<Map<string, DialogueIndexEntry>> {
  if (cachedDialogues) return cachedDialogues;
  const map = new Map<string, DialogueIndexEntry>();
  for (const dlg of manifest.entities.dialogues ?? []) {
    if (!dlg.path) continue;
    const rel = dialoguePathToFetch(dlg.path);
    if (!rel) continue;
    const raw = await fetchJson(rel);
    if (!raw) continue;
    const entry = indexDialogueJson(dlg.id, dlg.path, raw);
    map.set(`${dlg.id}::${dlg.path}`, entry);
  }
  cachedDialogues = map;
  return map;
}

export function clearSearchCache() {
  cachedDialogues = null;
}

export async function searchContent(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const manifest = await fetchManifest();
  const hits: SearchHit[] = [];

  for (const kind of ALL_ENTITY_KINDS) {
    for (const row of manifest.entities[kind] ?? []) {
      hits.push(...entityHits(row, kind, q));
    }
  }

  const dialogues = await loadDialogueIndex(manifest);
  for (const dlg of manifest.entities.dialogues ?? []) {
    const key = `${dlg.id}::${dlg.path ?? ""}`;
    const entry = dialogues.get(key);
    if (!entry) continue;
    const hit = dialogueFileHit(entry, dlg.id, q);
    if (hit) hits.push(hit);
  }

  const seen = new Set<string>();
  return hits
    .filter((h) => {
      const key = `${h.kind}:${h.id}:${h.path ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function kindLabel(kind: SearchHit["kind"]): string {
  if (kind === "dialogue_file") return "Dialogue text";
  return KIND_LABELS[kind];
}

export async function getDialogueEntry(
  manifestId: string,
  path?: string
): Promise<DialogueIndexEntry | null> {
  const manifest = await fetchManifest();
  const dialogues = await loadDialogueIndex(manifest);
  if (path) {
    return dialogues.get(`${manifestId}::${path}`) ?? null;
  }
  for (const [key, entry] of dialogues) {
    if (key.startsWith(`${manifestId}::`)) return entry;
  }
  return null;
}
