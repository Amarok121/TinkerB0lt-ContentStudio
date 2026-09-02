<script setup lang="ts">
import { computed, ref } from "vue";
import {
  loadItemEditorData,
  saveItemEditorData,
  serializeItemEditorState,
  groupsForType,
  syncEnFromCsv,
  suggestNextId,
  isIdAvailable,
  createBlankItem,
  duplicateItem,
  ITEM_DATA_PATH,
  ITEM_LOC_PATH,
  type ItemRecord,
  type ItemFieldDef,
  type ItemFieldGroup,
  type ItemType,
  type LocMap,
} from "@/lib/itemEditor";
import { IS_DEMO_MODE } from "@/lib/contentClient";
import SaveDiffModal from "@/components/SaveDiffModal.vue";
import type { DiffFile } from "@/lib/diffUtils";

const ITEM_TYPES: ItemType[] = ["consumable", "equipment", "misc", "quest"];

const items = ref<ItemRecord[]>([]);
const headers = ref<string[]>([]);
const csvRows = ref<Record<string, string>[]>([]);
const loc = ref<LocMap>({});
const selectedId = ref<string>("");
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const status = ref("");
const search = ref("");
const snapshot = ref("");
const snapshotCsv = ref({ itemData: "", loc: "" });

const showNewDialog = ref(false);
const showDiff = ref(false);
const newItemMode = ref<"blank" | "duplicate">("blank");
const newItemType = ref<ItemType>("consumable");
const newItemId = ref("");

const selected = computed(() =>
  items.value.find((i) => i.id === selectedId.value) ?? null
);

const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter(
    (i) =>
      i.id.includes(q) ||
      i.nameEn.toLowerCase().includes(q) ||
      i.nameKo.includes(q) ||
      i.csv.Type?.toLowerCase().includes(q)
  );
});

const visibleGroups = computed((): ItemFieldGroup[] => {
  if (!selected.value) return [];
  return groupsForType(
    selected.value.csv.Type ?? "",
    headers.value,
    selected.value
  );
});

const dirty = computed(
  () => snapshot.value !== JSON.stringify({ items: items.value, loc: loc.value })
);

const newIdValid = computed(() => isIdAvailable(items.value, newItemId.value));

const diffFiles = computed((): DiffFile[] => {
  const next = serializeItemEditorState(headers.value, csvRows.value, items.value, loc.value);
  return [
    {
      label: "Item data",
      path: ITEM_DATA_PATH,
      before: snapshotCsv.value.itemData,
      after: next.itemDataCsv,
    },
    {
      label: "Localization",
      path: ITEM_LOC_PATH,
      before: snapshotCsv.value.loc,
      after: next.locCsv,
    },
  ];
});

function refreshSuggestedId() {
  newItemId.value = suggestNextId(items.value, newItemType.value);
}

async function load() {
  loading.value = true;
  error.value = "";
  status.value = "";
  try {
    const data = await loadItemEditorData();
    headers.value = data.headers;
    csvRows.value = data.csvRows;
    items.value = data.items;
    loc.value = data.loc;
    if (!selectedId.value && items.value.length) {
      selectedId.value = items.value[0].id;
    }
    snapshot.value = JSON.stringify({ items: items.value, loc: loc.value });
    const serialized = serializeItemEditorState(
      headers.value,
      csvRows.value,
      items.value,
      loc.value
    );
    snapshotCsv.value = {
      itemData: serialized.itemDataCsv,
      loc: serialized.locCsv,
    };
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function confirmSave() {
  if (!items.value.length) return;
  saving.value = true;
  error.value = "";
  status.value = "";
  try {
    await saveItemEditorData(headers.value, csvRows.value, items.value, loc.value);
    snapshot.value = JSON.stringify({ items: items.value, loc: loc.value });
    const serialized = serializeItemEditorState(
      headers.value,
      csvRows.value,
      items.value,
      loc.value
    );
    snapshotCsv.value = {
      itemData: serialized.itemDataCsv,
      loc: serialized.locCsv,
    };
    showDiff.value = false;
    status.value =
      "Saved item_data.csv + item_localization.csv. Re-open Godot to reimport translations.";
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

function openSavePreview() {
  if (!dirty.value) return;
  showDiff.value = true;
}

function openNewDialog(mode: "blank" | "duplicate") {
  newItemMode.value = mode;
  if (mode === "duplicate" && selected.value?.csv.Type) {
    newItemType.value = selected.value.csv.Type as ItemType;
  }
  refreshSuggestedId();
  showNewDialog.value = true;
}

function onNewTypeChange() {
  refreshSuggestedId();
}

function confirmNewItem() {
  error.value = "";
  const id = newItemId.value.trim();
  if (!isIdAvailable(items.value, id)) {
    error.value = `ID ${id} is invalid or already in use.`;
    return;
  }

  const item =
    newItemMode.value === "duplicate" && selected.value
      ? duplicateItem(selected.value, headers.value, id)
      : createBlankItem(headers.value, id, newItemType.value);

  items.value.push(item);
  items.value.sort((a, b) => Number(a.id) - Number(b.id));
  loc.value[`ITEM_${id}_NAME`] = { en: item.nameEn, ko: item.nameKo };
  loc.value[`ITEM_${id}_DESC`] = { en: item.descEn, ko: item.descKo };

  selectedId.value = id;
  showNewDialog.value = false;
  status.value =
    newItemMode.value === "duplicate"
      ? `Duplicated as #${id}. Edit fields and save.`
      : `Created #${id}. Fill in fields and save.`;
}

function syncEnglish() {
  if (!selected.value) return;
  syncEnFromCsv(selected.value);
}

function fieldValue(item: ItemRecord, field: ItemFieldDef): string {
  if (field.key === "_name_en") return item.nameEn;
  if (field.key === "_name_ko") return item.nameKo;
  if (field.key === "_desc_en") return item.descEn;
  if (field.key === "_desc_ko") return item.descKo;
  return item.csv[field.key] ?? "";
}

function setFieldValue(item: ItemRecord, field: ItemFieldDef, value: string) {
  if (field.key === "_name_en") item.nameEn = value;
  else if (field.key === "_name_ko") item.nameKo = value;
  else if (field.key === "_desc_en") item.descEn = value;
  else if (field.key === "_desc_ko") item.descKo = value;
  else item.csv[field.key] = value;
}

function isFieldVisible(groupId: string, type: string): boolean {
  if (groupId === "equipment" && type !== "equipment") return false;
  if (groupId === "stain" && type !== "consumable") return false;
  return true;
}

load();
</script>

<template>
  <section class="item-editor">
    <header class="toolbar">
      <div>
        <h2>Items</h2>
        <p class="muted">
          Grouped editor + localization (<code>ITEM_{id}_NAME/DESC</code>)
          <span v-if="dirty" class="dirty">unsaved</span>
        </p>
      </div>
      <div class="toolbar-actions">
        <template v-if="!IS_DEMO_MODE">
          <button type="button" class="btn" :disabled="loading" @click="openNewDialog('blank')">
            + New
          </button>
          <button
            type="button"
            class="btn"
            :disabled="loading || !selected"
            @click="openNewDialog('duplicate')"
          >
            Duplicate
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

    <div v-if="!loading && !error" class="editor-layout">
      <aside class="item-list">
        <input v-model="search" class="search" placeholder="Search id, name, type…" />
        <button
          v-for="item in filteredItems"
          :key="item.id"
          type="button"
          class="item-row"
          :class="{ active: item.id === selectedId }"
          @click="selectedId = item.id"
        >
          <span class="item-id">{{ item.id }}</span>
          <span class="item-name">{{ item.nameKo || item.nameEn || "—" }}</span>
          <span class="item-type">{{ item.csv.Type }}</span>
        </button>
      </aside>

      <main v-if="selected" class="item-detail">
        <div class="detail-header">
          <h3>{{ selected.nameKo || selected.nameEn }} <small>#{{ selected.id }}</small></h3>
          <button type="button" class="btn btn-sm" @click="syncEnglish">
            Copy CSV Name/Description → EN loc
          </button>
        </div>

        <div v-for="group in visibleGroups" :key="group.id" class="field-group">
          <h4>{{ group.label }}</h4>
          <div class="field-grid">
            <template v-for="field in group.fields" :key="field.key">
              <label
                v-if="isFieldVisible(group.id, selected.csv.Type)"
                class="field"
                :class="{ wide: field.type === 'textarea' }"
              >
                <span class="field-label">{{ field.label }}</span>
                <textarea
                  v-if="field.type === 'textarea'"
                  :value="fieldValue(selected, field)"
                  :readonly="field.readonly"
                  rows="4"
                  @input="
                    setFieldValue(
                      selected,
                      field,
                      ($event.target as HTMLTextAreaElement).value
                    )
                  "
                />
                <select
                  v-else-if="field.type === 'enum'"
                  :value="fieldValue(selected, field)"
                  @change="
                    setFieldValue(selected, field, ($event.target as HTMLSelectElement).value)
                  "
                >
                  <option v-for="opt in field.options" :key="opt" :value="opt">
                    {{ opt || "—" }}
                  </option>
                </select>
                <select
                  v-else-if="field.type === 'bool'"
                  :value="fieldValue(selected, field)"
                  @change="
                    setFieldValue(selected, field, ($event.target as HTMLSelectElement).value)
                  "
                >
                  <option value="">FALSE</option>
                  <option value="TRUE">TRUE</option>
                </select>
                <input
                  v-else
                  type="text"
                  :value="fieldValue(selected, field)"
                  :readonly="field.readonly"
                  @input="
                    setFieldValue(selected, field, ($event.target as HTMLInputElement).value)
                  "
                />
                <span v-if="field.hint" class="hint">{{ field.hint }}</span>
              </label>
            </template>
          </div>
        </div>
      </main>
    </div>

    <dialog v-if="showNewDialog" class="modal" open @click.self="showNewDialog = false">
      <form class="modal-card" @submit.prevent="confirmNewItem">
        <h3>{{ newItemMode === "duplicate" ? "Duplicate item" : "New item" }}</h3>
        <p v-if="newItemMode === 'duplicate' && selected" class="muted">
          Copying from #{{ selected.id }} {{ selected.nameEn }}
        </p>

        <label class="field">
          <span class="field-label">Type</span>
          <select
            v-model="newItemType"
            :disabled="newItemMode === 'duplicate'"
            @change="onNewTypeChange"
          >
            <option v-for="t in ITEM_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">ID (auto-suggested)</span>
          <input v-model="newItemId" type="text" inputmode="numeric" pattern="[0-9]+" />
          <span v-if="!newIdValid" class="hint error-text">ID must be a unique positive number.</span>
        </label>

        <div class="modal-actions">
          <button type="button" class="btn" @click="showNewDialog = false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="!newIdValid">Create</button>
        </div>
      </form>
    </dialog>

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
.item-editor {
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

.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.85rem;
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

.error-text {
  color: #f88;
}

.editor-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 1rem;
  min-height: 520px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.5rem;
  max-height: 70vh;
  overflow: auto;
}

.search {
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #444;
  background: #1e1e26;
  color: #eee;
  margin-bottom: 0.25rem;
}

.item-row {
  display: grid;
  grid-template-columns: 3rem 1fr auto;
  gap: 0.35rem;
  align-items: center;
  text-align: left;
  padding: 0.4rem 0.5rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #ddd;
  cursor: pointer;
}

.item-row:hover {
  background: #2a2a35;
}

.item-row.active {
  background: #3a4a6a;
}

.item-id {
  font-size: 0.75rem;
  color: #888;
}

.item-name {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-type {
  font-size: 0.65rem;
  text-transform: uppercase;
  color: #888;
}

.item-detail {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  overflow: auto;
  max-height: 70vh;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.detail-header h3 {
  margin: 0;
}

.detail-header small {
  color: #888;
  font-weight: normal;
}

.field-group {
  margin-bottom: 1.25rem;
}

.field-group h4 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #9cf;
  border-bottom: 1px solid #333;
  padding-bottom: 0.25rem;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field.wide {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 0.75rem;
  color: #aaa;
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

.hint {
  font-size: 0.7rem;
  color: #666;
}

.modal {
  position: fixed;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
}

.modal-card {
  background: #1e1e28;
  border: 1px solid #444;
  border-radius: 10px;
  padding: 1.25rem;
  min-width: 320px;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-card h3 {
  margin: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

@media (max-width: 800px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
}
</style>
