<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  useVueTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/vue-table";
import {
  fetchCsv,
  parseCsv,
  csvToRecords,
  recordsToCsv,
  serializeCsv,
  saveContentFile,
  IS_DEMO_MODE,
  type WritableContentPath,
} from "@/lib/contentClient";
import SaveDiffModal from "@/components/SaveDiffModal.vue";
import type { DiffFile } from "@/lib/diffUtils";

const props = defineProps<{
  path: WritableContentPath;
  /** Columns shown in the editor (all columns still saved). */
  columns: string[];
  title: string;
}>();

const headers = ref<string[]>([]);
const rows = ref<Record<string, string>[]>([]);
const snapshot = ref("");
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const status = ref("");
const showDiff = ref(false);

const dirty = computed(() => {
  if (!snapshot.value) return false;
  return snapshot.value !== serializeCsv(recordsToCsv(headers.value, rows.value));
});

const pendingCsv = computed(() => serializeCsv(recordsToCsv(headers.value, rows.value)));

const diffFiles = computed((): DiffFile[] => [
  {
    label: props.title,
    path: props.path,
    before: snapshot.value,
    after: pendingCsv.value,
  },
]);

const tableColumns = computed<ColumnDef<Record<string, string>>[]>(() =>
  props.columns.map((col) => ({
    accessorKey: col,
    header: col,
    cell: (info) => info.getValue() as string,
  }))
);

const table = useVueTable({
  get data() {
    return rows.value;
  },
  get columns() {
    return tableColumns.value;
  },
  getCoreRowModel: getCoreRowModel(),
});

async function load() {
  loading.value = true;
  error.value = "";
  status.value = "";
  showDiff.value = false;
  try {
    const text = await fetchCsv(props.path);
    const parsed = parseCsv(text);
    const rec = csvToRecords(parsed);
    headers.value = rec.headers;
    rows.value = rec.rows;
    snapshot.value = serializeCsv(recordsToCsv(rec.headers, rec.rows));
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openSavePreview() {
  if (!dirty.value) return;
  showDiff.value = true;
}

async function confirmSave() {
  saving.value = true;
  error.value = "";
  status.value = "";
  try {
    const csv = pendingCsv.value;
    await saveContentFile(props.path, csv);
    snapshot.value = csv;
    showDiff.value = false;
    status.value = "Saved. Re-import in Godot (CSV → .tres / item_data.json).";
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

function updateCell(rowIndex: number, column: string, value: string) {
  rows.value = rows.value.map((row, i) =>
    i === rowIndex ? { ...row, [column]: value } : row
  );
}

watch(
  () => props.path,
  () => {
    load();
  },
  { immediate: true }
);
</script>

<template>
  <section class="panel spreadsheet-panel">
    <div class="toolbar">
      <div>
        <h2>{{ title }}</h2>
        <p class="muted">
          <code>{{ path }}</code>
          <span v-if="dirty" class="dirty-badge">unsaved</span>
        </p>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="btn" :disabled="loading" @click="load">
          Reload
        </button>
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
    </div>

    <p v-if="loading" class="muted">Loading…</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="status" class="success">{{ status }}</p>

    <div v-if="!loading && !error" class="table-wrap">
      <table class="spreadsheet">
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th v-for="header in headerGroup.headers" :key="header.id">
              {{ header.column.columnDef.header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in table.getRowModel().rows" :key="row.id">
            <td v-for="cell in row.getVisibleCells()" :key="cell.id">
              <input
                class="cell-input"
                :readonly="IS_DEMO_MODE"
                :value="String(cell.getValue() ?? '')"
                @input="
                  updateCell(
                    rowIndex,
                    cell.column.id,
                    ($event.target as HTMLInputElement).value
                  )
                "
              />
            </td>
          </tr>
        </tbody>
      </table>
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
.spreadsheet-panel {
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
}

.btn {
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  border: 1px solid #444;
  background: #252530;
  color: #eee;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: #3a5a8a;
  border-color: #4a6a9a;
}

.dirty-badge {
  margin-left: 0.5rem;
  color: #fc6;
  font-size: 0.8rem;
}

.success {
  color: #8d8;
}

.spreadsheet {
  width: max-content;
  min-width: 100%;
}

.cell-input {
  width: 100%;
  min-width: 6rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1e1e26;
  color: #eee;
  font: inherit;
}

.cell-input:focus {
  outline: 1px solid #6af;
  border-color: #6af;
}
</style>
