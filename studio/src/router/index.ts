import { createRouter, createWebHistory } from "vue-router";
import SearchView from "@/views/SearchView.vue";
import EntityBrowserView from "@/views/EntityBrowserView.vue";
import OverviewView from "@/views/OverviewView.vue";
import EnemiesView from "@/views/EnemiesView.vue";
import ItemEditorView from "@/views/ItemEditorView.vue";
import GraphView from "@/views/GraphView.vue";
import FlagsView from "@/views/FlagsView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: OverviewView },
    { path: "/entities", component: EntityBrowserView },
    { path: "/search", component: SearchView },
    { path: "/enemies", component: EnemiesView },
    { path: "/items", component: ItemEditorView },
    { path: "/graph", component: GraphView },
    { path: "/flags", component: FlagsView },
  ],
});
