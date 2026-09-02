<script setup lang="ts">
import CsvSpreadsheet from "@/components/CsvSpreadsheet.vue";

const ENEMY_COLUMNS = [
  "definition_id",
  "name_ko",
  "name_en",
  "max_health",
  "attack_power",
  "speed",
  "fortitude",
  "max_energy",
  "fire_res",
  "elec_res",
  "frost_res",
  "detection_range",
  "race",
  "use_boss_health_bar",
];
</script>

<template>
  <CsvSpreadsheet
    title="Enemies"
    path="Assets/PreFabs/Entity/Enemy/Definitions/enemy_definitions.csv"
    :columns="ENEMY_COLUMNS"
  />
</template>
