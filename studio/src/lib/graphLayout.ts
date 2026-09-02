import type { ContentRef } from "./contentClient";

export interface GraphSubgraph {
  nodeIds: Set<string>;
  refs: ContentRef[];
}

/** Collect nodes within N hops of focus along refs (undirected). */
export function extractNeighborhood(
  focusId: string,
  allRefs: ContentRef[],
  hops = 2
): GraphSubgraph {
  let frontier = new Set([focusId]);
  const included = new Set([focusId]);

  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const ref of allRefs) {
      const touches = frontier.has(ref.from) || frontier.has(ref.to);
      if (!touches) continue;
      included.add(ref.from);
      included.add(ref.to);
      next.add(ref.from);
      next.add(ref.to);
    }
    frontier = next;
  }

  const refs = allRefs.filter(
    (r) => included.has(r.from) && included.has(r.to)
  );
  return { nodeIds: included, refs };
}

export interface FlowLayoutNode {
  id: string;
  x: number;
  y: number;
}

/** Radial layout: focus at center, others on rings by hop distance. */
export function layoutNeighborhood(
  focusId: string,
  nodeIds: Set<string>,
  refs: ContentRef[]
): Map<string, FlowLayoutNode> {
  const hop = new Map<string, number>();
  hop.set(focusId, 0);
  let frontier = [focusId];

  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const d = hop.get(id)!;
      for (const ref of refs) {
        for (const neighbor of [ref.from, ref.to]) {
          if (!nodeIds.has(neighbor) || hop.has(neighbor)) continue;
          hop.set(neighbor, d + 1);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  for (const id of nodeIds) {
    if (!hop.has(id)) hop.set(id, 3);
  }

  const byHop = new Map<number, string[]>();
  for (const [id, d] of hop) {
    if (!byHop.has(d)) byHop.set(d, []);
    byHop.get(d)!.push(id);
  }

  const positions = new Map<string, FlowLayoutNode>();
  positions.set(focusId, { id: focusId, x: 0, y: 0 });

  for (const [d, ids] of byHop) {
    if (d === 0) continue;
    const radius = 160 + d * 130;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / Math.max(ids.length, 1);
      positions.set(id, {
        id,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });
  }

  return positions;
}

export function gridLayout(nodeIds: string[]): Map<string, FlowLayoutNode> {
  const list = [...nodeIds].sort();
  const cols = Math.ceil(Math.sqrt(list.length));
  const positions = new Map<string, FlowLayoutNode>();
  list.forEach((id, i) => {
    positions.set(id, {
      id,
      x: (i % cols) * 280,
      y: Math.floor(i / cols) * 100,
    });
  });
  return positions;
}
