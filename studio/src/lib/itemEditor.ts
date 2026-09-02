import {
  fetchCsv,
  parseCsv,
  serializeCsv,
  saveContentFile,
  type WritableContentPath,
} from "./contentClient";
import itemFieldsJson from "@/data/item_fields.json";

export const ITEM_DATA_PATH =
  "Assets/PreFabs/Scenes/Inventory/Items/item_data.csv" as WritableContentPath;
export const ITEM_LOC_PATH =
  "Assets/PreFabs/Scenes/Inventory/Items/item_localization.csv" as WritableContentPath;

export interface ItemFieldDef {
  key: string;
  label: string;
  type: string;
  options?: string[];
  readonly?: boolean;
  hint?: string;
  loc_key?: "NAME" | "DESC";
}

export interface ItemFieldGroup {
  id: string;
  label: string;
  fields: ItemFieldDef[];
}

export interface ItemRecord {
  id: string;
  csv: Record<string, string>;
  nameEn: string;
  nameKo: string;
  descEn: string;
  descKo: string;
}

export type LocMap = Record<string, { en: string; ko: string }>;

export type ItemType = "equipment" | "consumable" | "misc" | "quest";

interface IdRange {
  min: number;
  max: number;
}

interface AutoGroupDef {
  id: string;
  label: string;
  column_pattern: string;
  field_type?: string;
  hint?: string;
}

interface ItemFieldsSchema {
  schema_version: number;
  id_ranges?: Record<string, IdRange>;
  auto_groups?: AutoGroupDef[];
  groups: ItemFieldGroup[];
}

const schema = itemFieldsJson as ItemFieldsSchema;

export const ITEM_FIELD_GROUPS = schema.groups;
export const ITEM_ID_RANGES: Record<string, IdRange> = schema.id_ranges ?? {
  equipment: { min: 1, max: 999 },
  consumable: { min: 1001, max: 1999 },
  misc: { min: 2000, max: 2999 },
  quest: { min: 3000, max: 3999 },
};
const AUTO_GROUPS = schema.auto_groups ?? [];

const LOCALIZATION_KEYS = new Set(["_name_en", "_name_ko", "_desc_en", "_desc_ko"]);

export function locKey(itemId: string, kind: "NAME" | "DESC"): string {
  return `ITEM_${itemId}_${kind}`;
}

export function knownCsvFieldKeys(): Set<string> {
  const keys = new Set<string>();
  for (const group of ITEM_FIELD_GROUPS) {
    for (const field of group.fields) {
      if (!LOCALIZATION_KEYS.has(field.key)) {
        keys.add(field.key);
      }
    }
  }
  return keys;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function inferFieldType(value: string): string {
  const v = value.trim();
  if (v === "TRUE" || v === "FALSE") return "bool";
  if (/^-?\d+$/.test(v)) return "int";
  if (/^-?\d+(\.\d+)?$/.test(v)) return "float";
  if (v.startsWith("res://")) return "path";
  return "string";
}

function fieldDefFromColumn(
  column: string,
  value: string,
  auto?: AutoGroupDef
): ItemFieldDef {
  return {
    key: column,
    label: column.replace(/_/g, " "),
    type: auto?.field_type ?? inferFieldType(value),
    hint:
      auto?.hint ??
      "From CSV column — add to content/schema/item_fields.json for a custom label",
  };
}

/** CSV columns not in schema, bucketed by auto_groups patterns. */
export function discoverExtraFieldGroups(
  headers: string[],
  item: ItemRecord
): ItemFieldGroup[] {
  const known = knownCsvFieldKeys();
  const unmatched: string[] = [];

  for (const header of headers) {
    if (!header || header === "ID" || known.has(header)) continue;
    unmatched.push(header);
  }

  const groups: ItemFieldGroup[] = [];

  for (const auto of AUTO_GROUPS) {
    const regex = globToRegExp(auto.column_pattern);
    const fields = unmatched
      .filter((col) => regex.test(col))
      .map((col) => fieldDefFromColumn(col, item.csv[col] ?? "", auto));
    if (fields.length) {
      groups.push({ id: auto.id, label: auto.label, fields });
    }
  }

  const matched = new Set(groups.flatMap((g) => g.fields.map((f) => f.key)));
  const remaining = unmatched.filter((col) => !matched.has(col));
  if (remaining.length) {
    groups.push({
      id: "extra_columns",
      label: "Additional columns (CSV)",
      fields: remaining.map((col) => fieldDefFromColumn(col, item.csv[col] ?? "")),
    });
  }

  return groups;
}

export function parseLocalizationCsv(text: string): LocMap {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const map: LocMap = {};
  for (const row of rows.slice(1)) {
    const key = row[0]?.trim();
    if (!key) continue;
    map[key] = { en: row[1] ?? "", ko: row[2] ?? "" };
  }
  return map;
}

export function serializeLocalizationCsv(map: LocMap): string {
  const keys = Object.keys(map).sort();
  const rows = [["keys", "en", "ko"], ...keys.map((k) => [k, map[k].en, map[k].ko])];
  return serializeCsv(rows);
}

export function isItemRowActive(row: Record<string, string>): boolean {
  const id = row.ID?.trim();
  if (!id || id === "0") return false;
  const hasName = !!row.Name?.trim();
  const hasType = !!row.Type?.trim();
  return hasName || hasType;
}

export function mergeItemRecords(
  csvRows: Record<string, string>[],
  loc: LocMap
): ItemRecord[] {
  return csvRows
    .filter(isItemRowActive)
    .map((csv) => {
      const id = csv.ID.trim();
      const nameKey = locKey(id, "NAME");
      const descKey = locKey(id, "DESC");
      return {
        id,
        csv,
        nameEn: loc[nameKey]?.en ?? csv.Name ?? "",
        nameKo: loc[nameKey]?.ko ?? "",
        descEn: loc[descKey]?.en ?? csv.Description ?? "",
        descKo: loc[descKey]?.ko ?? "",
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export function applyLocalizationToMap(item: ItemRecord, loc: LocMap): void {
  loc[locKey(item.id, "NAME")] = { en: item.nameEn, ko: item.nameKo };
  loc[locKey(item.id, "DESC")] = { en: item.descEn, ko: item.descKo };
}

export function ensureLocKeys(items: ItemRecord[], loc: LocMap): void {
  for (const item of items) {
    const nk = locKey(item.id, "NAME");
    const dk = locKey(item.id, "DESC");
    if (!loc[nk]) {
      loc[nk] = { en: item.csv.Name ?? "", ko: "" };
    }
    if (!loc[dk]) {
      loc[dk] = { en: item.csv.Description ?? "", ko: "" };
    }
  }
}

export function createBlankCsvRow(
  headers: string[],
  id: string,
  type: ItemType
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const header of headers) {
    row[header] = "";
  }
  row.ID = id;
  row.Type = type;
  row.Stack_Amount = "1";
  row.Min_Amount = "1";
  row.Max_Amount = "1";
  return row;
}

export function suggestNextId(items: ItemRecord[], type: ItemType): string {
  const range = ITEM_ID_RANGES[type] ?? { min: 1, max: 9999 };
  const used = new Set(
    items.map((item) => Number(item.id)).filter((n) => Number.isFinite(n))
  );
  for (let id = range.min; id <= range.max; id++) {
    if (!used.has(id)) return String(id);
  }
  return String(range.max + 1);
}

export function isIdAvailable(items: ItemRecord[], id: string, exceptId?: string): boolean {
  const trimmed = id.trim();
  if (!trimmed || trimmed === "0") return false;
  if (!/^\d+$/.test(trimmed)) return false;
  return !items.some((item) => item.id === trimmed && item.id !== exceptId);
}

export function createBlankItem(
  headers: string[],
  id: string,
  type: ItemType
): ItemRecord {
  const csv = createBlankCsvRow(headers, id, type);
  csv.Name = "New Item";
  return {
    id,
    csv,
    nameEn: "New Item",
    nameKo: "",
    descEn: "",
    descKo: "",
  };
}

export function duplicateItem(
  source: ItemRecord,
  headers: string[],
  newId: string
): ItemRecord {
  const type = (source.csv.Type ?? "consumable") as ItemType;
  const csv: Record<string, string> = {
    ...createBlankCsvRow(headers, newId, type),
    ...source.csv,
    ID: newId,
  };
  const copySuffix = " (copy)";
  const nameEn = (source.nameEn || source.csv.Name || "New Item") + copySuffix;
  const nameKo = source.nameKo ? source.nameKo + copySuffix : "";
  csv.Name = nameEn;
  return {
    id: newId,
    csv,
    nameEn,
    nameKo,
    descEn: source.descEn || source.csv.Description || "",
    descKo: source.descKo,
  };
}

export function validateItems(items: ItemRecord[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.id.trim()) {
      errors.push("An item is missing an ID.");
      continue;
    }
    if (seen.has(item.id)) {
      errors.push(`Duplicate item ID: ${item.id}`);
    }
    seen.add(item.id);
    if (!item.csv.Type?.trim()) {
      errors.push(`Item #${item.id}: Type is required.`);
    }
  }
  return errors;
}

export async function loadItemEditorData(): Promise<{
  headers: string[];
  csvRows: Record<string, string>[];
  items: ItemRecord[];
  loc: LocMap;
}> {
  const [dataText, locText] = await Promise.all([
    fetchCsv(ITEM_DATA_PATH),
    fetchCsv(ITEM_LOC_PATH),
  ]);
  const parsed = parseCsv(dataText);
  const headers = parsed[0] ?? [];
  const csvRows = parsed.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
  const loc = parseLocalizationCsv(locText);
  const items = mergeItemRecords(csvRows, loc);
  ensureLocKeys(items, loc);
  return { headers, csvRows, items, loc };
}

export function serializeItemEditorState(
  headers: string[],
  csvRows: Record<string, string>[],
  items: ItemRecord[],
  loc: LocMap
): { itemDataCsv: string; locCsv: string } {
  const rowsCopy = csvRows.map((row) => ({ ...row }));
  const locCopy: LocMap = {};
  for (const [key, value] of Object.entries(loc)) {
    locCopy[key] = { ...value };
  }

  for (const item of items) {
    applyLocalizationToMap(item, locCopy);
    if (item.nameEn) item.csv.Name = item.nameEn;
    if (item.descEn) item.csv.Description = item.descEn;
    item.csv.ID = item.id;

    const idx = rowsCopy.findIndex((r) => r.ID?.trim() === item.id);
    if (idx >= 0) {
      rowsCopy[idx] = {
        ...createBlankCsvRow(headers, item.id, item.csv.Type as ItemType),
        ...rowsCopy[idx],
        ...item.csv,
      };
    } else {
      const row = createBlankCsvRow(headers, item.id, (item.csv.Type ?? "consumable") as ItemType);
      rowsCopy.push({ ...row, ...item.csv, ID: item.id });
    }
  }

  ensureLocKeys(items, locCopy);
  return {
    itemDataCsv: serializeCsv([
      headers,
      ...rowsCopy.map((row) => headers.map((h) => row[h] ?? "")),
    ]),
    locCsv: serializeLocalizationCsv(locCopy),
  };
}

export async function saveItemEditorData(
  headers: string[],
  csvRows: Record<string, string>[],
  items: ItemRecord[],
  loc: LocMap
): Promise<void> {
  const validationErrors = validateItems(items);
  if (validationErrors.length) {
    throw new Error(validationErrors.join("\n"));
  }

  const { itemDataCsv, locCsv } = serializeItemEditorState(headers, csvRows, items, loc);

  for (const item of items) {
    const idx = csvRows.findIndex((r) => r.ID?.trim() === item.id);
    if (idx >= 0) {
      csvRows[idx] = { ...csvRows[idx], ...item.csv, ID: item.id };
    } else {
      const row = createBlankCsvRow(headers, item.id, (item.csv.Type ?? "consumable") as ItemType);
      csvRows.push({ ...row, ...item.csv, ID: item.id });
    }
    applyLocalizationToMap(item, loc);
  }
  ensureLocKeys(items, loc);

  await saveContentFile(ITEM_DATA_PATH, itemDataCsv);
  await saveContentFile(ITEM_LOC_PATH, locCsv);
}

export function syncEnFromCsv(item: ItemRecord): void {
  item.nameEn = item.csv.Name?.trim() || item.nameEn;
  item.descEn = item.csv.Description?.trim() || item.descEn;
}

export function groupsForType(
  type: string,
  headers?: string[],
  item?: ItemRecord
): ItemFieldGroup[] {
  const always = ["identity", "localization", "attributes", "economy"];
  const byType: Record<string, string[]> = {
    equipment: ["equipment", "combat", "consumable"],
    consumable: ["combat", "consumable", "stain"],
    misc: [],
    quest: [],
  };
  const ids = new Set([...always, ...(byType[type] ?? [])]);
  const groups = ITEM_FIELD_GROUPS.filter((g) => ids.has(g.id));

  if (headers && item) {
    groups.push(...discoverExtraFieldGroups(headers, item));
  }

  return groups;
}
