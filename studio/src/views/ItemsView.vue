<script setup lang="ts">
import CsvSpreadsheet from "@/components/CsvSpreadsheet.vue";

const ITEM_COLUMNS = [
  "ID",
  "Name",
  "Type",
  "Attack_Power",
  "Attack_Rate",
  "Base_Fortitude",
  "Cost",
  "Drop_Chance",
  "Stack_Amount",
  "is_Essential",
  "Physical_Attribute",
  "Elemental_Attribute",
];
</script>

<template>
  <CsvSpreadsheet
    title="Items"
    path="Assets/PreFabs/Scenes/Inventory/Items/item_data.csv"
    :columns="ITEM_COLUMNS"
  />
</template>
