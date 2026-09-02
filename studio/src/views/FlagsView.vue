<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchManifest, saveContentFile, contentFileUrl, IS_DEMO_MODE } from "@/lib/contentClient";
import { buildRefIndex, refsIncoming, refsOutgoing } from "@/lib/manifestIndex";
import ReferencePanel from "@/components/ReferencePanel.vue";
import SaveDiffModal from "@/components/SaveDiffModal.vue";
import type { DiffFile } from "@/lib/diffUtils";

const FLAGS_PATH = "content/registries/flags_registry.json";

interface FlagEntry {
  id: string;
  label: string;
  type: "bool" | "int" | "string" | "enum";
  default: boolean | number | string;
  scope: "global" | "event";
  owner_id?: string;
  enum_values?: string[];
  notes?: string;
}

interface FlagsRegistry {
  schema_version: number;
  flags: FlagEntry[];
}

const router = useRouter();

const registry = ref<FlagsRegistry>({ schema_version: 1, flags: [] });
const snapshotJson = ref("");
const selectedId = ref("");
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const status = ref("");
const showDiff = ref(false);
const manifestRefs = ref(buildRefIndex([]));

const selected = computed(
  () => registry.value.flags.find((f) => f.id === selectedId.value) ?? null
);

const dirty = computed(
  () => snapshotJson.value !== JSON.stringify(registry.value, null, 2) + "\n"
);

const diffFiles = computed((): DiffFile[] => [
  {
    label: "Flags registry",
    path: FLAGS_PATH,
    before: snapshotJson.value,
    after: JSON.stringify(registry.value, null, 2) + "\n",
  },
]);

const refIndex = computed(() => manifestRefs.value);

const outgoingRefs = computed(() =>
  selectedId.value ? refsOutgoing(selectedId.value, refIndex.value) : []
);

const incomingRefs = computed(() =>
  selectedId.value ? refsIncoming(selectedId.value, refIndex.value) : []
);

async function load() {
  loading.value = true;
  error.value = "";
  status.value = "";
  showDiff.value = false;
  try {
    const [flagsRes, manifest] = await Promise.all([
      fetch(contentFileUrl(FLAGS_PATH)),
      fetchManifest(),
    ]);
    if (!flagsRes.ok) throw new Error("Failed to load flags registry");
    registry.value = await flagsRes.json();
    manifestRefs.value = buildRefIndex(manifest.refs);
    snapshotJson.value = JSON.stringify(registry.value, null, 2) + "\n";
    if (!selectedId.value && registry.value.flags.length) {
      selectedId.value = registry.value.flags[0].id;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function selectFlag(id: string) {
  selectedId.value = id;
}

function addFlag() {
  const entry: FlagEntry = {
    id: "flag:new_flag",
    label: "New flag",
    type: "bool",
    default: false,
    scope: "global",
    notes: "",
  };
  registry.value.flags.push(entry);
  selectedId.value = entry.id;
}

function removeSelected() {
  if (!selected.value) return;
  registry.value.flags = registry.value.flags.filter((f) => f.id !== selected.value!.id);
  selectedId.value = registry.value.flags[0]?.id ?? "";
}

function updateSelected(field: keyof FlagEntry, value: string) {
  if (!selected.value) return;
  const flag = selected.value;
  if (field === "type") {
    flag.type = value as FlagEntry["type"];
    if (flag.type === "bool") flag.default = false;
    else if (flag.type === "int") flag.default = 0;
    else if (flag.type === "string") flag.default = "";
    else if (flag.type === "enum") {
      flag.default = "";
      flag.enum_values = flag.enum_values ?? ["a", "b"];
    }
    return;
  }
  if (field === "scope") {
    flag.scope = value as FlagEntry["scope"];
    if (flag.scope === "global") flag.owner_id = undefined;
    return;
  }
  if (field === "default") {
    if (flag.type === "bool") flag.default = value === "true";
    else if (flag.type === "int") flag.default = Number(value) || 0;
    else flag.default = value;
    return;
  }
  if (field === "enum_values") {
    flag.enum_values = value.split(",").map((s) => s.trim()).filter(Boolean);
    return;
  }
  (flag as Record<string, unknown>)[field] = value;
}

function openEntity(id: string) {
  router.push({ path: "/entities", query: { id } });
}

function openSavePreview() {
  if (!dirty.value) return;
  const validationError = validateFlags();
  if (validationError) {
    error.value = validationError;
    return;
  }
  showDiff.value = true;
}

function validateFlags(): string | null {
  const seen = new Set<string>();
  for (const flag of registry.value.flags) {
    if (!flag.id.startsWith("flag:")) return `Invalid flag id: ${flag.id}`;
    if (seen.has(flag.id)) return `Duplicate flag id: ${flag.id}`;
    seen.add(flag.id);
    if (!flag.label.trim()) return `Flag ${flag.id} needs a label`;
    if (flag.scope === "event" && !flag.owner_id?.trim()) {
      return `Flag ${flag.id} (event scope) needs owner_id`;
    }
    if (flag.type === "enum" && (!flag.enum_values || flag.enum_values.length === 0)) {
      return `Flag ${flag.id} (enum) needs enum_values`;
    }
  }
  return null;
}

async function confirmSave() {
  saving.value = true;
  error.value = "";
  status.value = "";
  try {
    const validationError = validateFlags();
    if (validationError) throw new Error(validationError);
    const content = JSON.stringify(registry.value, null, 2) + "\n";
    await saveContentFile(FLAGS_PATH, content);
    snapshotJson.value = content;
    showDiff.value = false;
    status.value = "Saved flags_registry.json";
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="flags-editor">
    <header class="toolbar">
      <div>
        <h2>Flags</h2>
        <p class="muted">
          <code>{{ FLAGS_PATH }}</code>
          <span v-if="dirty" class="dirty">unsaved</span>
        </p>
      </div>
      <div class="toolbar-actions">
        <template v-if="!IS_DEMO_MODE">
          <button type="button" class="btn" @click="addFlag">+ New flag</button>
          <button type="button" class="btn" :disabled="!selected" @click="removeSelected">
            Remove
          </button>
        </template>
        <button type="button" class="btn" :disabled="loading" @click="load">Reload</button>
        <button
          v-if="!IS_DEMO_MODE"
          type="button"
          class="btn btn-primary"
          :disabled="loading || saving || !dirty"
          @click="openSavePreview"
        >
          Review &amp; save
        </button>
      </div>
    </header>

    <p v-if="loading" class="muted">Loading…</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="status" class="success">{{ status }}</p>

    <div v-if="!loading" class="flags-layout">
      <aside class="flag-list">
        <button
          v-for="flag in registry.flags"
          :key="flag.id"
          type="button"
          class="flag-row"
          :class="{ active: flag.id === selectedId }"
          @click="selectFlag(flag.id)"
        >
          <span class="flag-label">{{ flag.label }}</span>
          <code>{{ flag.id }}</code>
        </button>
      </aside>

      <main v-if="selected" class="flag-detail">
        <h3>{{ selected.label }}</h3>
        <div class="field-grid">
          <label class="field">
            <span>ID</span>
            <input
              :value="selected.id"
              @input="updateSelected('id', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field">
            <span>Label</span>
            <input
              :value="selected.label"
              @input="updateSelected('label', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field">
            <span>Type</span>
            <select
              :value="selected.type"
              @change="updateSelected('type', ($event.target as HTMLSelectElement).value)"
            >
              <option value="bool">bool</option>
              <option value="int">int</option>
              <option value="string">string</option>
              <option value="enum">enum</option>
            </select>
          </label>
          <label class="field">
            <span>Default</span>
            <select
              v-if="selected.type === 'bool'"
              :value="String(selected.default)"
              @change="updateSelected('default', ($event.target as HTMLSelectElement).value)"
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
            <input
              v-else
              :value="String(selected.default)"
              @input="updateSelected('default', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field">
            <span>Scope</span>
            <select
              :value="selected.scope"
              @change="updateSelected('scope', ($event.target as HTMLSelectElement).value)"
            >
              <option value="global">global</option>
              <option value="event">event</option>
            </select>
          </label>
          <label v-if="selected.scope === 'event'" class="field">
            <span>Owner event id</span>
            <input
              :value="selected.owner_id ?? ''"
              @input="updateSelected('owner_id', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label v-if="selected.type === 'enum'" class="field wide">
            <span>Enum values (comma-separated)</span>
            <input
              :value="(selected.enum_values ?? []).join(', ')"
              @input="updateSelected('enum_values', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field wide">
            <span>Notes</span>
            <textarea
              :value="selected.notes ?? ''"
              rows="3"
              @input="updateSelected('notes', ($event.target as HTMLTextAreaElement).value)"
            />
          </label>
        </div>
        <p v-if="selected.owner_id" class="muted owner-link">
          Owner:
          <button type="button" class="link-btn" @click="openEntity(selected.owner_id!)">
            {{ selected.owner_id }}
          </button>
        </p>
      </main>

      <aside v-if="selected" class="refs-column">
        <ReferencePanel
          title="References"
          direction="out"
          :refs="outgoingRefs"
          empty-text="This flag does not reference other ids."
        />
        <ReferencePanel
          title="Referenced by"
          direction="in"
          :refs="incomingRefs"
          empty-text="Nothing in manifest references this flag yet."
        />
      </aside>
    </div>

    <SaveDiffModal
      :open="showDiff"
      :files="diffFiles"
      :saving="saving"
      @confirm="confirmSave"
      @cancel="showDiff = false"
    />
  </section>
</template>

<style scoped>
.flags-editor {
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

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  border: 1px solid #444;
  background: #252530;
  color: #eee;
  cursor: pointer;
}

.btn-primary {
  background: #3a5a8a;
  border-color: #4a6a9a;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dirty {
  color: #fc6;
  margin-left: 0.5rem;
}

.success {
  color: #8d8;
}

.flags-layout {
  display: grid;
  grid-template-columns: 240px minmax(280px, 1fr) 280px;
  gap: 1rem;
  align-items: start;
}

.flag-list {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 70vh;
  overflow: auto;
}

.flag-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.45rem 0.5rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #ddd;
  cursor: pointer;
  text-align: left;
}

.flag-row.active {
  background: #3a4a6a;
}

.flag-label {
  font-size: 0.85rem;
}

.flag-row code {
  font-size: 0.68rem;
  color: #888;
}

.flag-detail {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
}

.flag-detail h3 {
  margin: 0 0 0.75rem;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.65rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: #aaa;
}

.field.wide {
  grid-column: 1 / -1;
}

.field input,
.field select,
.field textarea {
  padding: 0.35rem 0.5rem;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1e1e26;
  color: #eee;
  font: inherit;
}

.owner-link {
  margin-top: 0.75rem;
  font-size: 0.85rem;
}

.link-btn {
  background: none;
  border: none;
  color: #9cf;
  cursor: pointer;
  padding: 0;
  font: inherit;
}

.refs-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (max-width: 1000px) {
  .flags-layout {
    grid-template-columns: 1fr;
  }
}
</style>
