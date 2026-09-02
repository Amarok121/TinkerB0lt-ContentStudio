<script setup lang="ts">
import { ref } from "vue";
import { fetchValidation, type ValidationResult } from "@/lib/contentClient";

const loading = ref(false);
const result = ref<ValidationResult | null>(null);
const error = ref("");

async function run() {
  loading.value = true;
  error.value = "";
  try {
    result.value = await fetchValidation();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    result.value = null;
  } finally {
    loading.value = false;
  }
}

defineExpose({ run, result, loading });
</script>

<template>
  <section class="validate-panel">
    <div class="validate-toolbar">
      <button type="button" class="btn" :disabled="loading" @click="run">
        {{ loading ? "Validating…" : "Run validation" }}
      </button>
      <span v-if="result?.ok" class="badge ok">✓ No blocking errors</span>
      <span v-else-if="result && !result.ok" class="badge fail">✗ {{ result.errors.length }} errors</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="result">
      <p v-if="result.stats.entities" class="muted stats-line">
        {{ result.stats.entities }} entities · {{ result.stats.refs }} refs ·
        {{ result.stats.flags }} flags
      </p>
      <ul v-if="result.errors.length" class="msg-list errors">
        <li v-for="(msg, i) in result.errors" :key="`e-${i}`">{{ msg }}</li>
      </ul>
      <ul v-if="result.warnings.length" class="msg-list warnings">
        <li v-for="(msg, i) in result.warnings" :key="`w-${i}`">{{ msg }}</li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.validate-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.badge {
  font-size: 0.85rem;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
}

.badge.ok {
  background: #1a3a2a;
  color: #8d8;
}

.badge.fail {
  background: #3a1a1a;
  color: #f88;
}

.stats-line {
  margin: 0.75rem 0 0.35rem;
  font-size: 0.85rem;
}

.msg-list {
  margin: 0.35rem 0 0;
  padding-left: 1.25rem;
  font-size: 0.85rem;
}

.msg-list.errors {
  color: #f88;
}

.msg-list.warnings {
  color: #fc6;
}
</style>
