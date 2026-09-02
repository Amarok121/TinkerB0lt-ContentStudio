<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { searchContent, kindLabel, clearSearchCache, getDialogueEntry, type SearchHit } from "@/lib/contentSearch";
import DialogueTreeView from "@/components/DialogueTreeView.vue";
import type { DialogueIndexEntry } from "@/lib/dialogueIndex";

const router = useRouter();

const query = ref("");
const hits = ref<SearchHit[]>([]);
const loading = ref(false);
const error = ref("");
const dialoguePreview = ref<DialogueIndexEntry | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function runSearch(q: string) {
  if (!q.trim()) {
    hits.value = [];
    dialoguePreview.value = null;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    hits.value = await searchContent(q);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    hits.value = [];
  } finally {
    loading.value = false;
  }
}

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch(q), 250);
});

function openHit(hit: SearchHit) {
  router.push({ path: "/entities", query: { id: hit.id } });
}

async function previewDialogue(hit: SearchHit) {
  if (hit.kind !== "dialogue_file") {
    dialoguePreview.value = null;
    return;
  }
  dialoguePreview.value = await getDialogueEntry(hit.id, hit.path);
}

function refreshIndex() {
  clearSearchCache();
  runSearch(query.value);
}
</script>

<template>
  <section class="search-view">
    <header>
      <h2>Search</h2>
      <p class="muted">
        Manifest entities + dialogue line text (e.g. try <code>halcyon</code>,
        <code>vendor</code>, <code>Wake up</code>)
      </p>
    </header>

    <div class="search-bar">
      <input
        v-model="query"
        type="search"
        placeholder="Search ids, titles, dialogue text…"
        autofocus
      />
      <button type="button" class="btn" @click="refreshIndex">Rebuild index</button>
    </div>

    <p v-if="loading" class="muted">Searching…</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="query && !loading && hits.length === 0" class="muted">No results.</p>

    <div v-if="hits.length" class="results-layout">
      <ul class="hit-list">
        <li v-for="hit in hits" :key="`${hit.kind}-${hit.id}-${hit.path}`">
          <button type="button" class="hit-row" @click="openHit(hit)">
            <span class="kind">{{ kindLabel(hit.kind) }}</span>
            <span class="title">{{ hit.title }}</span>
            <code class="id">{{ hit.id }}</code>
            <span class="snippet">{{ hit.snippet }}</span>
          </button>
          <button
            v-if="hit.kind === 'dialogue_file'"
            type="button"
            class="btn-sm"
            @click.stop="previewDialogue(hit)"
          >
            Tree
          </button>
        </li>
      </ul>

      <aside v-if="dialoguePreview" class="dialogue-preview">
        <h3>Dialogue tree</h3>
        <p class="muted"><code>{{ dialoguePreview.path }}</code></p>
        <DialogueTreeView :nodes="dialoguePreview.tree" />
      </aside>
    </div>
  </section>
</template>

<style scoped>
.search-view {
  max-width: none;
}

.search-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-bar input {
  flex: 1;
  padding: 0.5rem 0.65rem;
  border: 1px solid #444;
  border-radius: 6px;
  background: #1e1e26;
  color: #eee;
  font: inherit;
}

.btn,
.btn-sm {
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  border: 1px solid #444;
  background: #252530;
  color: #eee;
  cursor: pointer;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.results-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1rem;
  align-items: start;
}

.hit-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

.hit-list li {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #2a2a35;
}

.hit-list li:last-child {
  border-bottom: none;
}

.hit-row {
  flex: 1;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.65rem;
  text-align: left;
  padding: 0.65rem 0.75rem;
  border: none;
  background: transparent;
  color: #ddd;
  cursor: pointer;
}

.hit-row:hover {
  background: #2a2a35;
}

.kind {
  grid-row: span 2;
  align-self: center;
  font-size: 0.65rem;
  text-transform: uppercase;
  color: #888;
}

.title {
  font-weight: 600;
  font-size: 0.9rem;
}

.id {
  grid-column: 2;
  font-size: 0.72rem;
  color: #888;
}

.snippet {
  grid-column: 2;
  font-size: 0.78rem;
  color: #aaa;
}

.dialogue-preview {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.75rem;
  max-height: 70vh;
  overflow: auto;
}

.dialogue-preview h3 {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
}

@media (max-width: 900px) {
  .results-layout {
    grid-template-columns: 1fr;
  }
}
</style>
