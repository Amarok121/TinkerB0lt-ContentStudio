export interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffFile {
  label: string;
  path: string;
  before: string;
  after: string;
}

/** Line-aligned diff (good enough for CSV / JSON text previews). */
export function diffText(before: string, after: string): DiffLine[] {
  const oldLines = normalizeLines(before);
  const newLines = normalizeLines(after);
  const result: DiffLine[] = [];
  const max = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < max; i++) {
    const oldText = oldLines[i];
    const newText = newLines[i];
    if (oldText === newText) {
      if (oldText !== undefined) {
        result.push({ type: "same", text: oldText, oldLine: i + 1, newLine: i + 1 });
      }
    } else {
      if (oldText !== undefined) {
        result.push({ type: "remove", text: oldText, oldLine: i + 1 });
      }
      if (newText !== undefined) {
        result.push({ type: "add", text: newText, newLine: i + 1 });
      }
    }
  }
  return result;
}

export function collapseDiff(lines: DiffLine[], context = 2): DiffLine[] {
  const changed = new Set<number>();
  lines.forEach((line, i) => {
    if (line.type !== "same") changed.add(i);
  });
  if (changed.size === 0) return lines;

  const keep = new Set<number>();
  for (const idx of changed) {
    for (let c = idx - context; c <= idx + context; c++) {
      if (c >= 0 && c < lines.length) keep.add(c);
    }
  }

  const out: DiffLine[] = [];
  let lastKept = -1;
  const sorted = [...keep].sort((a, b) => a - b);
  for (const idx of sorted) {
    if (lastKept >= 0 && idx > lastKept + 1) {
      out.push({ type: "same", text: "…" });
    }
    out.push(lines[idx]);
    lastKept = idx;
  }
  return out;
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number; changed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === "add") added++;
    if (line.type === "remove") removed++;
  }
  return { added, removed, changed: Math.min(added, removed) + Math.abs(added - removed) };
}

function normalizeLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
