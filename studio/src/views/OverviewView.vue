<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { fetchManifest, type ContentManifest } from "@/lib/contentClient";
import ValidatePanel from "@/components/ValidatePanel.vue";

const manifest = ref<ContentManifest | null>(null);
const error = ref("");
const loading = ref(true);
const validatePanel = ref<InstanceType<typeof ValidatePanel> | null>(null);

onMounted(async () => {
  try {
    manifest.value = await fetchManifest();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});

function count(m: ContentManifest, key: keyof ContentManifest["entities"]) {
  return m.entities[key]?.length ?? 0;
}
</script>

<template>
  <section class="panel">
    <h2>Overview</h2>
    <p class="muted">
      Monorepo layout: <code>studio/</code> reads <code>content/</code> and CSV
      from the parent Godot project via dev API.
    </p>

    <section class="validate-section">
      <h3>Content validation</h3>
      <ValidatePanel ref="validatePanel" />
    </section>

    <p v-if="loading">Loading manifest…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="manifest">
      <p class="muted">Generated: {{ manifest.generated_at }}</p>
      <ul class="stats">
        <li>Quests: {{ count(manifest, "quests") }}</li>
        <li>Events: {{ count(manifest, "events") }}</li>
        <li>Dialogues: {{ count(manifest, "dialogues") }}</li>
        <li>Flags: {{ count(manifest, "flags") }}</li>
        <li>Enemies: {{ count(manifest, "enemies") }}</li>
        <li>Items: {{ count(manifest, "items") }}</li>
        <li>Cross-refs: {{ manifest.refs.length }}</li>
      </ul>
      <p class="quick-links">
        <RouterLink to="/entities">Browse entities &amp; references →</RouterLink>
        ·
        <RouterLink to="/search">Search all content →</RouterLink>
      </p>
      <p
        v-if="count(manifest, 'quests') === 0"
        class="warn"
      >
        Manifest is empty — run
        <code>generate_content_manifest.gd</code> in Godot (File → Run), then
        refresh.
      </p>
    </template>
  </section>
</template>

<style scoped>
.quick-links {
  margin-top: 1rem;
}

.quick-links a {
  color: #9cf;
}

.validate-section {
  margin: 1.25rem 0;
  padding: 1rem;
  border: 1px solid #333;
  border-radius: 8px;
  background: #1e1e26;
}

.validate-section h3 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
}
</style>
