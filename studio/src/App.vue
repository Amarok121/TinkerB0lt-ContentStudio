<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { IS_DEMO_MODE } from "@/lib/contentClient";
</script>

<template>
  <div class="layout">
    <p v-if="IS_DEMO_MODE" class="demo-banner">
      Portfolio demo — read-only sample data (no game assets)
    </p>
    <header class="header">
      <h1>{{ IS_DEMO_MODE ? "Content Studio Demo" : "TinkerB0lt Content Studio" }}</h1>
      <nav>
        <RouterLink to="/">Overview</RouterLink>
        <RouterLink to="/entities">Entities</RouterLink>
        <RouterLink to="/enemies">Enemies</RouterLink>
        <RouterLink to="/items">Items</RouterLink>
        <RouterLink to="/search">Search</RouterLink>
        <RouterLink to="/graph">Graph</RouterLink>
        <RouterLink to="/flags">Flags</RouterLink>
      </nav>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.demo-banner {
  margin: 0;
  padding: 0.5rem 1.5rem;
  background: #2a2840;
  color: #c9c0ff;
  font-size: 0.9rem;
  border-bottom: 1px solid #443;
  text-align: center;
}
</style>
