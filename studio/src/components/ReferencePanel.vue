<script setup lang="ts">
import { useRouter } from "vue-router";
import type { ContentRef } from "@/lib/contentClient";
import { refTypeLabel } from "@/lib/manifestIndex";

const props = defineProps<{
  title: string;
  refs: ContentRef[];
  emptyText?: string;
  direction: "out" | "in";
}>();

const router = useRouter();

function peerId(ref: ContentRef): string {
  return props.direction === "out" ? ref.to : ref.from;
}

function navigateTo(id: string) {
  router.push({ path: "/entities", query: { id } });
}
</script>

<template>
  <section class="ref-panel">
    <h4>{{ title }} <span class="count">{{ refs.length }}</span></h4>
    <p v-if="refs.length === 0" class="muted empty">{{ emptyText ?? "None" }}</p>
    <ul v-else class="ref-list">
      <li v-for="(ref, i) in refs" :key="`${ref.from}-${ref.type}-${ref.to}-${i}`">
        <span class="ref-type">{{ refTypeLabel(ref.type) }}</span>
        <button type="button" class="ref-link" @click="navigateTo(peerId(ref))">
          <code>{{ peerId(ref) }}</code>
        </button>
        <span v-if="direction === 'out' && ref.from !== ref.to" class="ref-from muted">
          from <code>{{ ref.from }}</code>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.ref-panel {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.75rem;
  background: #1e1e26;
}

.ref-panel h4 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #9cf;
}

.count {
  color: #666;
  font-weight: normal;
}

.empty {
  margin: 0;
  font-size: 0.85rem;
}

.ref-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ref-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid #2a2a35;
  font-size: 0.82rem;
}

.ref-list li:last-child {
  border-bottom: none;
}

.ref-type {
  font-size: 0.68rem;
  text-transform: uppercase;
  color: #888;
  min-width: 5.5rem;
}

.ref-link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: #9cf;
  font: inherit;
}

.ref-link:hover code {
  background: #3a4a6a;
}

.ref-from {
  font-size: 0.72rem;
  width: 100%;
}
</style>
