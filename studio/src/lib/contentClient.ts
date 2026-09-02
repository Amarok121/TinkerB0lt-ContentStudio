export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const CONTENT_BASE = IS_DEMO_MODE ? "/content" : "/api/content";

/** Map monorepo CSV paths to bundled demo/content paths. */
const DEMO_CSV_PATHS: Record<string, string> = {
  "Assets/PreFabs/Entity/Enemy/Definitions/enemy_definitions.csv":
    "data/enemy_definitions.csv",
  "Assets/PreFabs/Scenes/Inventory/Items/item_data.csv": "data/item_data.csv",
  "Assets/PreFabs/Scenes/Inventory/Items/item_localization.csv":
    "data/item_localization.csv",
};

export function resolveFetchPath(relativePath: string): string {
  if (!IS_DEMO_MODE) return relativePath;
  return DEMO_CSV_PATHS[relativePath] ?? relativePath;
}

export function contentFileUrl(relativePath: string): string {
  if (IS_DEMO_MODE) {
    const demoPath = relativePath.startsWith("content/")
      ? relativePath.slice("content/".length)
      : resolveFetchPath(relativePath);
    return `${CONTENT_BASE}/${demoPath}`;
  }
  return `/api/content/${relativePath}`;
}

/** Repo-relative paths allowed for studio write (dev server only). */
export const WRITABLE_CONTENT_PATHS = [
  "Assets/PreFabs/Entity/Enemy/Definitions/enemy_definitions.csv",
  "Assets/PreFabs/Scenes/Inventory/Items/item_data.csv",
  "Assets/PreFabs/Scenes/Inventory/Items/item_localization.csv",
  "content/registries/flags_registry.json",
] as const;

export type WritableContentPath = (typeof WRITABLE_CONTENT_PATHS)[number];

export function isWritablePath(path: string): path is WritableContentPath {
  return (WRITABLE_CONTENT_PATHS as readonly string[]).includes(path);
}

export interface ContentManifest {
  schema_version: number;
  generated_at: string;
  entities: {
    quests: EntityRow[];
    events: EntityRow[];
    dialogues: EntityRow[];
    flags: EntityRow[];
    enemies: EntityRow[];
    items: EntityRow[];
  };
  refs: ContentRef[];
}

export interface EntityRow {
  id: string;
  title?: string;
  name?: string;
  name_en?: string;
  name_ko?: string;
  path?: string;
  label?: string;
  steps?: { id: string; title: string }[];
}

export interface ContentRef {
  from: string;
  type: string;
  to: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: { flags: number; entities: number; refs: number };
}

export async function fetchValidation(): Promise<ValidationResult> {
  if (IS_DEMO_MODE) {
    const manifest = await fetchManifest();
    const entities = Object.values(manifest.entities).reduce(
      (n, rows) => n + (rows?.length ?? 0),
      0
    );
    return {
      ok: true,
      errors: [],
      warnings: [],
      stats: {
        flags: manifest.entities.flags?.length ?? 0,
        entities,
        refs: manifest.refs?.length ?? 0,
      },
    };
  }
  const res = await fetch("/api/content/validate");
  if (!res.ok) throw new Error("Validation request failed");
  return res.json();
}

export async function fetchManifest(): Promise<ContentManifest> {
  const res = await fetch(
    contentFileUrl("content/generated/content_manifest.json")
  );
  if (!res.ok) throw new Error("Failed to load manifest");
  return res.json();
}

export async function fetchCsv(relativePath: string): Promise<string> {
  const res = await fetch(contentFileUrl(relativePath));
  if (!res.ok) throw new Error(`Failed to load ${relativePath}`);
  return res.text();
}

export async function saveContentFile(
  relativePath: WritableContentPath,
  content: string
): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new Error("Demo mode is read-only");
  }
  const res = await fetch("/api/content/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath, content }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Save failed: ${relativePath}`);
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.length)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function serializeCsv(rows: string[][]): string {
  const lines = rows.map((row) =>
    row
      .map((cell) => {
        const value = cell ?? "";
        if (/[",\r\n]/.test(value)) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(",")
  );
  return lines.join("\n") + (lines.length ? "\n" : "");
}

export function csvToRecords(
  parsed: string[][]
): { headers: string[]; rows: Record<string, string>[] } {
  const headers = parsed[0] ?? [];
  const rows = parsed.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

export function recordsToCsv(
  headers: string[],
  rows: Record<string, string>[]
): string[][] {
  return [
    headers,
    ...rows.map((row) => headers.map((h) => row[h] ?? "")),
  ];
}
