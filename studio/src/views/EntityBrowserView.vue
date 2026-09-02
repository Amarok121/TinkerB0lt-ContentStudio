<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchManifest, type ContentManifest } from "@/lib/contentClient";
import {
  ALL_ENTITY_KINDS,
  KIND_LABELS,
  NARRATIVE_KINDS,
  buildRefIndex,
  filterEntities,
  findEntity,
  flattenManifestEntities,
  refsIncoming,
  refsOutgoing,
  type EntityKind,
  type ManifestEntity,
} from "@/lib/manifestIndex";
import ReferencePanel from "@/components/ReferencePanel.vue";
import DialogueTreeView from "@/components/DialogueTreeView.vue";
import { getDialogueEntry } from "@/lib/contentSearch";
import type { DialogueIndexEntry } from "@/lib/dialogueIndex";

type KindFilter = EntityKind | "all";

const route = useRoute();
const router = useRouter();

const manifest = ref<ContentManifest | null>(null);
const entities = ref<ManifestEntity[]>([]);
const loading = ref(true);
const error = ref("");

const kindFilter = ref<KindFilter>("all");
const search = ref("");
const selectedId = ref("");
const refContextId = ref("");
const showAllKinds = ref(false);
const dialogueTree = ref<DialogueIndexEntry | null>(null);

const kindOptions = computed(() =>
  showAllKinds.value ? ALL_ENTITY_KINDS : NARRATIVE_KINDS
);

const filtered = computed(() =>
  filterEntities(entities.value, { kind: kindFilter.value, query: search.value })
);

const selected = computed(() => findEntity(entities.value, selectedId.value) ?? null);

const refIndex = computed(() =>
  manifest.value ? buildRefIndex(manifest.value.refs) : buildRefIndex([])
);

const outgoingRefs = computed(() =>
  refContextId.value ? refsOutgoing(refContextId.value, refIndex.value) : []
);

const incomingRefs = computed(() =>
  refContextId.value ? refsIncoming(refContextId.value, refIndex.value) : []
);

const refContextLabel = computed(() => {
  if (!refContextId.value) return "";
  if (refContextId.value === selectedId.value) return selected.value?.title ?? refContextId.value;
  const step = selected.value?.row.steps?.find((s) => s.id === refContextId.value);
  return step?.title?.trim() || refContextId.value;
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    manifest.value = await fetchManifest();
    entities.value = flattenManifestEntities(manifest.value);
    applyRouteSelection();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function applyRouteSelection() {
  const idFromRoute = typeof route.query.id === "string" ? route.query.id : "";
  if (idFromRoute && findEntity(entities.value, idFromRoute)) {
    selectEntity(idFromRoute, false);
    return;
  }
  if (!selectedId.value && filtered.value.length) {
    selectEntity(filtered.value[0].id, false);
  }
}

function selectEntity(id: string, pushRoute = true) {
  selectedId.value = id;
  refContextId.value = id;
  if (pushRoute) {
    router.replace({ path: "/entities", query: { id } });
  }
}

function selectStep(stepId: string) {
  refContextId.value = stepId;
}

function resetRefContext() {
  refContextId.value = selectedId.value;
}

function setKindFilter(kind: KindFilter) {
  kindFilter.value = kind;
  if (selected.value && kind !== "all" && selected.value.kind !== kind) {
    const next = filtered.value[0];
    if (next) selectEntity(next.id);
  }
}

watch(
  () => route.query.id,
  (id) => {
    if (typeof id === "string" && id !== selectedId.value) {
      if (findEntity(entities.value, id)) selectEntity(id, false);
    }
  }
);

function openInGraph() {
  router.push({ path: "/graph", query: { focus: selectedId.value } });
}

async function loadDialogueTree() {
  dialogueTree.value = null;
  if (!selected.value || selected.value.kind !== "dialogues") return;
  dialogueTree.value = await getDialogueEntry(selected.value.id, selected.value.path);
}

watch(selected, () => {
  loadDialogueTree();
});

watch(filtered, (list) => {
  if (!list.length) return;
  if (!list.some((e) => e.id === selectedId.value)) {
    selectEntity(list[0].id);
  }
});

onMounted(load);
</script>

<template>
  <section class="entity-browser">
    <header class="toolbar">
      <div>
        <h2>Entities</h2>
        <p class="muted">
          Browse manifest entities and cross-references
          <span v-if="manifest" class="gen-at">· {{ manifest.generated_at }}</span>
        </p>
      </div>
      <div class="toolbar-actions">
        <label class="toggle">
          <input v-model="showAllKinds" type="checkbox" />
          Include enemies &amp; items
        </label>
        <button type="button" class="btn" :disabled="loading" @click="load">Reload</button>
      </div>
    </header>

    <p v-if="loading" class="muted">Loading manifest…</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="!loading && !error" class="browser-layout">
      <aside class="entity-list-panel">
        <div class="kind-chips">
          <button
            type="button"
            class="chip"
            :class="{ active: kindFilter === 'all' }"
            @click="setKindFilter('all')"
          >
            All
          </button>
          <button
            v-for="kind in kindOptions"
            :key="kind"
            type="button"
            class="chip"
            :class="{ active: kindFilter === kind }"
            @click="setKindFilter(kind)"
          >
            {{ KIND_LABELS[kind] }}
          </button>
        </div>
        <input v-model="search" class="search" placeholder="Search id, title, path…" />
        <p class="list-meta muted">{{ filtered.length }} entities</p>
        <div class="entity-list">
          <button
            v-for="entity in filtered"
            :key="`${entity.id}-${entity.path ?? ''}`"
            type="button"
            class="entity-row"
            :class="{ active: entity.id === selectedId }"
            @click="selectEntity(entity.id)"
          >
            <span class="kind-badge">{{ KIND_LABELS[entity.kind] }}</span>
            <span class="entity-title">{{ entity.title }}</span>
            <code class="entity-id">{{ entity.id }}</code>
          </button>
        </div>
      </aside>

      <main v-if="selected" class="entity-detail">
        <div class="detail-head">
          <span class="kind-badge large">{{ KIND_LABELS[selected.kind] }}</span>
          <h3>{{ selected.title }}</h3>
        </div>
        <div class="detail-actions">
          <button type="button" class="btn-sm" @click="openInGraph">View in graph</button>
        </div>
        <dl class="meta-grid">
          <dt>ID</dt>
          <dd><code>{{ selected.id }}</code></dd>
          <template v-if="selected.path">
            <dt>Source</dt>
            <dd><code class="path">{{ selected.path }}</code></dd>
          </template>
          <template v-if="selected.row.name_en">
            <dt>Name (EN)</dt>
            <dd>{{ selected.row.name_en }}</dd>
          </template>
          <template v-if="selected.row.name_ko">
            <dt>Name (KO)</dt>
            <dd>{{ selected.row.name_ko }}</dd>
          </template>
          <template v-if="selected.row.label">
            <dt>Label</dt>
            <dd>{{ selected.row.label }}</dd>
          </template>
        </dl>

        <section v-if="selected.row.steps?.length" class="steps-section">
          <h4>Steps</h4>
          <p class="muted steps-hint">Click a step to filter references for that step id.</p>
          <div class="steps-list">
            <button
              type="button"
              class="step-row"
              :class="{ active: refContextId === selected.id }"
              @click="resetRefContext"
            >
              <span class="step-title">(whole entity)</span>
              <code>{{ selected.id }}</code>
            </button>
            <button
              v-for="step in selected.row.steps"
              :key="step.id"
              type="button"
              class="step-row"
              :class="{ active: refContextId === step.id }"
              @click="selectStep(step.id)"
            >
              <span class="step-title">{{ step.title?.trim() || "—" }}</span>
              <code>{{ step.id }}</code>
            </button>
          </div>
        </section>

        <section v-if="dialogueTree?.tree.length" class="dialogue-section">
          <h4>Dialogue tree</h4>
          <DialogueTreeView :nodes="dialogueTree.tree" />
        </section>
      </main>

      <aside v-if="selected" class="refs-column">
        <p class="ref-context muted">
          References for <code>{{ refContextId }}</code>
          <span v-if="refContextLabel !== refContextId"> — {{ refContextLabel }}</span>
        </p>
        <ReferencePanel
          title="References"
          direction="out"
          :refs="outgoingRefs"
          empty-text="Nothing references outward from this id."
        />
        <ReferencePanel
          title="Referenced by"
          direction="in"
          :refs="incomingRefs"
          empty-text="Nothing points to this id yet."
        />
      </aside>
    </div>
  </section>
</template>

<style scoped>
.entity-browser {
  max-width: none;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.toolbar h2 {
  margin: 0 0 0.25rem;
}

.gen-at {
  font-size: 0.85em;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #aaa;
  cursor: pointer;
}

.btn {
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  border: 1px solid #444;
  background: #252530;
  color: #eee;
  cursor: pointer;
}

.browser-layout {
  display: grid;
  grid-template-columns: 280px minmax(280px, 1fr) 300px;
  gap: 1rem;
  min-height: 560px;
  align-items: start;
}

.entity-list-panel {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.65rem;
  max-height: 75vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.kind-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  border: 1px solid #444;
  background: #252530;
  color: #bbb;
  font-size: 0.72rem;
  cursor: pointer;
}

.chip.active {
  background: #3a5a8a;
  border-color: #4a6a9a;
  color: #fff;
}

.search {
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #444;
  background: #1e1e26;
  color: #eee;
}

.list-meta {
  margin: 0;
  font-size: 0.75rem;
}

.entity-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.entity-row {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: 0.15rem 0.4rem;
  text-align: left;
  padding: 0.45rem 0.5rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #ddd;
  cursor: pointer;
}

.entity-row:hover {
  background: #2a2a35;
}

.entity-row.active {
  background: #3a4a6a;
}

.kind-badge {
  grid-row: span 2;
  align-self: center;
  font-size: 0.6rem;
  text-transform: uppercase;
  background: #333;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  color: #aaa;
}

.kind-badge.large {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
}

.entity-title {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-id {
  grid-column: 2;
  font-size: 0.68rem;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entity-detail {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  max-height: 75vh;
  overflow: auto;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.detail-head h3 {
  margin: 0;
}

.detail-actions {
  margin-bottom: 0.75rem;
}

.btn-sm {
  padding: 0.3rem 0.55rem;
  font-size: 0.78rem;
  border-radius: 4px;
  border: 1px solid #444;
  background: #252530;
  color: #eee;
  cursor: pointer;
}

.dialogue-section h4 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #9cf;
}

.meta-grid {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 0.35rem 0.75rem;
  font-size: 0.85rem;
  margin: 0 0 1rem;
}

.meta-grid dt {
  color: #888;
}

.meta-grid dd {
  margin: 0;
}

.path {
  word-break: break-all;
}

.steps-section h4 {
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
  color: #9cf;
}

.steps-hint {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.step-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1e1e26;
  color: #ddd;
  cursor: pointer;
  text-align: left;
}

.step-row.active {
  border-color: #4a6a9a;
  background: #2a3548;
}

.step-title {
  font-size: 0.85rem;
}

.step-row code {
  font-size: 0.68rem;
  color: #888;
  flex-shrink: 0;
}

.refs-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 75vh;
  overflow: auto;
}

.ref-context {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
}

@media (max-width: 1100px) {
  .browser-layout {
    grid-template-columns: 1fr;
  }
}
</style>
