/** Extract searchable text and tree nodes from dialogue JSON (compiled or editor format). */

export interface DialogueTreeNode {
  id: string;
  type: string;
  label: string;
  children: DialogueTreeNode[];
}

export interface DialogueIndexEntry {
  dialogueId: string;
  path: string;
  snippets: string[];
  tree: DialogueTreeNode[];
}

function pushSnippet(out: string[], value: unknown) {
  if (typeof value === "string" && value.trim()) out.push(value.trim());
  else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.en === "string") out.push(obj.en);
    if (typeof obj.ko === "string") out.push(obj.ko);
  }
}

function walkCompiledSteps(
  steps: unknown[],
  tree: DialogueTreeNode[],
  snippets: string[]
) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as Record<string, unknown>;
    const type = String(step.type ?? "step");
    const node: DialogueTreeNode = {
      id: `step-${i}`,
      type,
      label: type,
      children: [],
    };

    if (type === "text" && step.text) {
      pushSnippet(snippets, step.text);
      if (typeof step.text === "object") {
        const t = step.text as Record<string, string>;
        node.label = t.en || t.ko || "text";
      } else {
        node.label = String(step.text);
      }
    } else if (type === "choice" && Array.isArray(step.choices)) {
      for (let c = 0; c < step.choices.length; c++) {
        const choice = step.choices[c] as Record<string, unknown>;
        pushSnippet(snippets, choice.text);
        const child: DialogueTreeNode = {
          id: `step-${i}-choice-${c}`,
          type: "choice",
          label: String(choice.text ?? `Choice ${c + 1}`),
          children: [],
        };
        if (Array.isArray(choice.steps)) {
          walkCompiledSteps(choice.steps, child.children, snippets);
        }
        node.children.push(child);
      }
      node.label = `choice (${node.children.length})`;
    } else {
      node.label = type;
    }

    tree.push(node);
  }
}

function buildEditorTree(
  data: Record<string, unknown>,
  snippets: string[]
): DialogueTreeNode[] {
  const nodes = (data.nodes as Record<string, unknown>[]) ?? [];
  const connections = (data.connections as Record<string, unknown>[]) ?? [];
  const byName = new Map<string, Record<string, unknown>>();
  for (const n of nodes) {
    if (n.name) byName.set(String(n.name), n);
  }

  const incoming = new Set<string>();
  for (const c of connections) {
    if (c.to_node) incoming.add(String(c.to_node));
  }

  const roots = nodes
    .map((n) => String(n.name))
    .filter((name) => !incoming.has(name));

  function nodeLabel(n: Record<string, unknown>): string {
    const type = String(n.type ?? "node");
    const d = (n.data as Record<string, unknown>) ?? {};
    if (type === "text" && d.text) {
      pushSnippet(snippets, d.text);
      return String(d.text).slice(0, 60);
    }
    if (type === "choice" && Array.isArray(d.choices)) {
      const choices = d.choices as Record<string, unknown>[];
      for (const ch of choices) pushSnippet(snippets, ch.text);
      return `choice (${choices.length})`;
    }
    return type;
  }

  function expand(name: string, seen: Set<string>): DialogueTreeNode | null {
    if (seen.has(name)) {
      return { id: name, type: "ref", label: `${name} (loop)`, children: [] };
    }
    seen.add(name);
    const n = byName.get(name);
    if (!n) return null;
    const out: DialogueTreeNode = {
      id: name,
      type: String(n.type ?? "node"),
      label: nodeLabel(n),
      children: [],
    };
    const outs = connections.filter((c) => c.from_node === name);
    for (const c of outs) {
      const child = expand(String(c.to_node), new Set(seen));
      if (child) out.children.push(child);
    }
    return out;
  }

  const tree: DialogueTreeNode[] = [];
  const start = roots.length ? roots : nodes[0]?.name ? [String(nodes[0].name)] : [];
  for (const root of start) {
    const node = expand(root, new Set());
    if (node) tree.push(node);
  }
  return tree;
}

export function indexDialogueJson(
  dialogueId: string,
  path: string,
  raw: unknown
): DialogueIndexEntry {
  const snippets: string[] = [];
  const tree: DialogueTreeNode[] = [];
  const data = raw as Record<string, unknown>;

  if (Array.isArray(data.dialogues)) {
    for (const dlg of data.dialogues as Record<string, unknown>[]) {
      const id = String(dlg.id ?? dialogueId);
      pushSnippet(snippets, id);
      if (Array.isArray(dlg.steps)) {
        const branch: DialogueTreeNode = {
          id,
          type: "dialogue",
          label: id,
          children: [],
        };
        walkCompiledSteps(dlg.steps, branch.children, snippets);
        tree.push(branch);
      }
    }
  } else if (Array.isArray(data.nodes)) {
    tree.push(...buildEditorTree(data, snippets));
  }

  return { dialogueId, path, snippets, tree };
}

export function dialogueMatchesQuery(entry: DialogueIndexEntry, q: string): boolean {
  const lower = q.toLowerCase();
  if (entry.dialogueId.toLowerCase().includes(lower)) return true;
  if (entry.path.toLowerCase().includes(lower)) return true;
  return entry.snippets.some((s) => s.toLowerCase().includes(lower));
}
