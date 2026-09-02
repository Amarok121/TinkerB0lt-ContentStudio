<script setup lang="ts">
import type { DialogueTreeNode } from "@/lib/dialogueIndex";

defineProps<{
  nodes: DialogueTreeNode[];
  depth?: number;
}>();
</script>

<template>
  <ul class="dialogue-tree" :class="{ nested: (depth ?? 0) > 0 }">
    <li v-for="node in nodes" :key="node.id">
      <span class="node-type">{{ node.type }}</span>
      <span class="node-label">{{ node.label }}</span>
      <DialogueTreeView
        v-if="node.children.length"
        :nodes="node.children"
        :depth="(depth ?? 0) + 1"
      />
    </li>
  </ul>
</template>

<style scoped>
.dialogue-tree {
  list-style: none;
  margin: 0;
  padding-left: 0;
}

.dialogue-tree.nested {
  padding-left: 1rem;
  border-left: 1px solid #333;
  margin-top: 0.25rem;
}

.dialogue-tree li {
  margin: 0.25rem 0;
  font-size: 0.82rem;
}

.node-type {
  display: inline-block;
  font-size: 0.65rem;
  text-transform: uppercase;
  color: #888;
  min-width: 3.5rem;
}

.node-label {
  color: #ddd;
}
</style>
