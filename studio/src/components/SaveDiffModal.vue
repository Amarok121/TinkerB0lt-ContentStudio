<script setup lang="ts">
import { computed } from "vue";
import {
  collapseDiff,
  diffStats,
  diffText,
  type DiffFile,
} from "@/lib/diffUtils";

const props = defineProps<{
  open: boolean;
  files: DiffFile[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const fileDiffs = computed(() =>
  props.files.map((file) => {
    const lines = diffText(file.before, file.after);
    return {
      ...file,
      lines: collapseDiff(lines),
      stats: diffStats(lines),
      unchanged: lines.every((l) => l.type === "same"),
    };
  })
);

const totalStats = computed(() => {
  let added = 0;
  let removed = 0;
  for (const file of fileDiffs.value) {
    added += file.stats.added;
    removed += file.stats.removed;
  }
  return { added, removed };
});
</script>

<template>
  <dialog v-if="open" class="modal" open @click.self="emit('cancel')">
    <div class="modal-card">
      <header class="modal-head">
        <h3>Review changes before save</h3>
        <p class="muted">
          +{{ totalStats.added }} / −{{ totalStats.removed }} lines across
          {{ files.length }} file(s)
        </p>
      </header>

      <div class="diff-stack">
        <section v-for="file in fileDiffs" :key="file.path" class="diff-file">
          <h4>
            {{ file.label }}
            <code>{{ file.path }}</code>
            <span v-if="file.unchanged" class="unchanged">no changes</span>
          </h4>
          <pre v-if="!file.unchanged" class="diff-view"><code><span
              v-for="(line, i) in file.lines"
              :key="`${file.path}-${i}`"
              class="diff-line"
              :class="line.type"
            ><span v-if="line.type === 'remove'" class="prefix">−</span><span
                v-else-if="line.type === 'add'"
                class="prefix"
              >+</span><span v-else class="prefix"> </span>{{ line.text }}
</span></code></pre>
        </section>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn" :disabled="saving" @click="emit('cancel')">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="emit('confirm')">
          {{ saving ? "Saving…" : "Confirm save" }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
}

.modal-card {
  background: #1a1a22;
  border: 1px solid #444;
  border-radius: 10px;
  width: min(920px, 94vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}

.modal-head {
  padding: 1rem 1.25rem 0.5rem;
}

.modal-head h3 {
  margin: 0 0 0.25rem;
}

.diff-stack {
  overflow: auto;
  padding: 0 1.25rem;
  flex: 1;
}

.diff-file h4 {
  margin: 0.75rem 0 0.35rem;
  font-size: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.unchanged {
  color: #666;
  font-weight: normal;
}

.diff-view {
  margin: 0;
  padding: 0.65rem;
  background: #121218;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: auto;
  font-size: 0.75rem;
  line-height: 1.45;
}

.diff-line {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-line.add {
  background: rgba(40, 120, 60, 0.25);
}

.diff-line.remove {
  background: rgba(140, 40, 40, 0.25);
}

.diff-line .prefix {
  display: inline-block;
  width: 1.2em;
  color: #888;
  user-select: none;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #333;
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
</style>
