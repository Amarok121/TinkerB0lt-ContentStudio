<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { VueFlow } from "@vue-flow/core";
import type { NodeMouseEvent } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import { fetchManifest, type ContentManifest, type ContentRef } from "@/lib/contentClient";
import {
  buildRefIndex,
  findEntity,
  flattenManifestEntities,
  refsIncoming,
  refsOutgoing,
  displayTitle,
} from "@/lib/manifestIndex";
import {
  extractNeighborhood,
  gridLayout,
  layoutNeighborhood,
} from "@/lib/graphLayout";
import ReferencePanel from "@/components/ReferencePanel.vue";

const route = useRoute();
const router = useRouter();

const manifest = ref<ContentManifest | null>(null);
const entities = ref<ReturnType<typeof flattenManifestEntities>>([]);
const refs = ref<ContentRef[]>([]);
const error = ref("");
const loading = ref(true);

const focusMode = ref(true);
const focusId = ref("");
const hops = ref(2);
const selectedNodeId = ref("");

const REF_COLORS: Record<string, string> = {
  sets_flag: "#6cf",
  requires_flag: "#f96",
  updates_quest: "#9c6",
  updates_event: "#c9f",
  rewards_item: "#fc6",
  starts_dialogue: "#f6c",
};

onMounted(async () => {
  try {
    manifest.value = await fetchManifest();
    entities.value = flattenManifestEntities(manifest.value);
    refs.value = manifest.value.refs;
    const fromRoute = typeof route.query.focus === "string" ? route.query.focus : "";
    if (fromRoute && entities.value.some((e) => e.id === fromRoute)) {
      focusId.value = fromRoute;
    } else if (refs.value.length) {
      focusId.value = refs.value[0].from;
    }
    selectedNodeId.value = focusId.value;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});

const refIndex = computed(() => buildRefIndex(refs.value));

const activeRefs = computed(() => {
  if (!focusMode.value || !focusId.value) return refs.value;
  return extractNeighborhood(focusId.value, refs.value, hops.value).refs;
});

const activeNodeIds = computed(() => {
  if (!focusMode.value || !focusId.value) {
    const ids = new Set<string>();
    for (const r of refs.value) {
      ids.add(r.from);
      ids.add(r.to);
    }
    return ids;
  }
  return extractNeighborhood(focusId.value, refs.value, hops.value).nodeIds;
});

const flowNodes = computed(() => {
  const ids = [...activeNodeIds.value];
  const layout = focusMode.value && focusId.value
    ? layoutNeighborhood(focusId.value, activeNodeIds.value, activeRefs.value)
    : gridLayout(ids);

  return ids.map((id) => {
    const pos = layout.get(id) ?? { id, x: 0, y: 0 };
    const entity = findEntity(entities.value, id);
    const label = entity ? `${displayTitle(entity.row)}\n${id}` : id;
    const isFocus = id === focusId.value;
    const isSelected = id === selectedNodeId.value;
    return {
      id,
      data: { label },
      position: { x: pos.x, y: pos.y },
      style: {
        background: nodeColor(id, isFocus, isSelected),
        color: "#eee",
        border: isSelected ? "2px solid #9cf" : "1px solid #555",
        borderRadius: "6px",
        fontSize: "11px",
        padding: "8px",
        maxWidth: "220px",
        whiteSpace: "pre-wrap" as const,
        boxShadow: isFocus ? "0 0 12px rgba(100,160,255,0.35)" : undefined,
      },
    };
  });
});

const flowEdges = computed(() =>
  activeRefs.value.map((r, i) => ({
    id: `e-${i}`,
    source: r.from,
    target: r.to,
    label: r.type,
    animated: r.type === "sets_flag" || r.type === "updates_quest",
    style: { stroke: REF_COLORS[r.type] ?? "#888" },
    labelStyle: { fill: "#ccc", fontSize: 10 },
  }))
);

const selectedEntity = computed(() =>
  findEntity(entities.value, selectedNodeId.value)
);

const outgoingRefs = computed(() =>
  selectedNodeId.value ? refsOutgoing(selectedNodeId.value, refIndex.value) : []
);

const incomingRefs = computed(() =>
  selectedNodeId.value ? refsIncoming(selectedNodeId.value, refIndex.value) : []
);

function nodeColor(id: string, isFocus: boolean, isSelected: boolean): string {
  if (isFocus) return "#3a5080";
  if (isSelected) return "#404860";
  if (id.startsWith("flag:")) return "#2a3040";
  if (id.startsWith("quest:")) return "#2a4030";
  if (id.startsWith("item:")) return "#403020";
  if (id.startsWith("event:")) return "#403050";
  return "#252530";
}

function onNodeClick(event: NodeMouseEvent) {
  selectedNodeId.value = event.node.id;
}

function setFocus(id: string) {
  focusId.value = id;
  selectedNodeId.value = id;
  router.replace({ path: "/graph", query: { focus: id } });
}

function openInEntities() {
  if (!selectedNodeId.value) return;
  router.push({ path: "/entities", query: { id: selectedNodeId.value } });
}

watch(
  () => route.query.focus,
  (id) => {
    if (typeof id === "string" && id !== focusId.value) {
      focusId.value = id;
      selectedNodeId.value = id;
      focusMode.value = true;
    }
  }
);
</script>

<template>
  <section class="panel graph-panel">
    <header class="graph-toolbar">
      <div>
        <h2>Content graph</h2>
        <p class="muted">Focus neighborhood or full graph — click node for refs</p>
      </div>
      <div class="controls">
        <label class="toggle">
          <input v-model="focusMode" type="checkbox" />
          Focus mode
        </label>
        <select v-model="focusId" :disabled="!focusMode" @change="setFocus(focusId)">
          <option v-for="e in entities" :key="`${e.id}-${e.path}`" :value="e.id">
            {{ e.title }} ({{ e.id }})
          </option>
        </select>
        <label v-if="focusMode" class="hops">
          Hops
          <input v-model.number="hops" type="number" min="1" max="4" />
        </label>
      </div>
    </header>

    <p v-if="loading" class="muted">Loading…</p>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-else-if="refs.length === 0" class="warn-box">
      No refs in manifest. Run
      <code>tools/content_pipeline/generate_manifest.bat</code>
    </div>

    <div v-else class="graph-layout">
      <div class="flow-wrap">
        <VueFlow
          :nodes="flowNodes"
          :edges="flowEdges"
          :fit-view-on-init="true"
          @node-click="onNodeClick"
        >
          <Background pattern-color="#333" :gap="16" />
        </VueFlow>
      </div>

      <aside v-if="selectedNodeId" class="side-panel">
        <h3>{{ selectedEntity?.title ?? selectedNodeId }}</h3>
        <code class="node-id">{{ selectedNodeId }}</code>
        <div class="side-actions">
          <button type="button" class="btn-sm" @click="setFocus(selectedNodeId)">
            Focus here
          </button>
          <button type="button" class="btn-sm" @click="openInEntities">
            Open in Entities
          </button>
        </div>
        <ReferencePanel
          title="References"
          direction="out"
          :refs="outgoingRefs"
          empty-text="No outgoing refs."
        />
        <ReferencePanel
          title="Referenced by"
          direction="in"
          :refs="incomingRefs"
          empty-text="No incoming refs."
        />
      </aside>
    </div>

    <ul class="legend">
      <li v-for="(color, type) in REF_COLORS" :key="type">
        <span class="swatch" :style="{ background: color }" />
        {{ type }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
.graph-panel {
  max-width: none;
}

.graph-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.graph-toolbar h2 {
  margin: 0 0 0.25rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.controls select {
  max-width: 280px;
  padding: 0.35rem 0.5rem;
  background: #1e1e26;
  border: 1px solid #444;
  color: #eee;
  border-radius: 4px;
}

.toggle,
.hops {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #aaa;
}

.hops input {
  width: 3rem;
  padding: 0.25rem;
  background: #1e1e26;
  border: 1px solid #444;
  color: #eee;
  border-radius: 4px;
}

.graph-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1rem;
}

.flow-wrap {
  height: 520px;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 520px;
  overflow: auto;
}

.side-panel h3 {
  margin: 0;
  font-size: 0.95rem;
}

.node-id {
  font-size: 0.72rem;
  color: #888;
}

.side-actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 0.3rem 0.55rem;
  font-size: 0.75rem;
  border-radius: 4px;
  border: 1px solid #444;
  background: #252530;
  color: #eee;
  cursor: pointer;
}

.warn-box {
  color: #fc6;
  background: #332200;
  padding: 0.75rem 1rem;
  border-radius: 6px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  list-style: none;
  padding: 0.75rem 0 0;
  margin: 0;
  font-size: 0.8rem;
  color: #aaa;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

@media (max-width: 900px) {
  .graph-layout {
    grid-template-columns: 1fr;
  }
}
</style>
