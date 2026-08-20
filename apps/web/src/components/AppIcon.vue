<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 });

const paths: Record<string, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M9 21v-7h6v7"],
  check: ["m5 12 4 4L19 6"],
  trend: ["M4 17 10 11l4 4 6-8", "M15 7h5v5"],
  diamond: ["m12 3 8 9-8 9-8-9 8-9Z"],
  target: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M12 12h.01",
  ],
  box: ["M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z", "m4 7.5 8 4.5 8-4.5", "M12 12v9"],
  list: ["M9 6h11M9 12h11M9 18h11", "M4 6h.01M4 12h.01M4 18h.01"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  automation: [
    "M12 3v4M12 17v4M3 12h4M17 12h4",
    "m5.6 5.6 2.8 2.8m7.2 7.2 2.8 2.8m0-12-2.8 2.8m-7.2 7.2-2.8 2.8",
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  ],
  chart: ["M4 20V10M10 20V4M16 20v-7M22 20H2"],
  person: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21a8 8 0 0 1 16 0"],
  building: [
    "M4 21V5l8-2 8 2v16",
    "M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M9 21v-5h6v5",
  ],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  ],
  key: ["M21 2 15 8", "M7.5 14.5a4.95 4.95 0 1 1 2-2L12 10l2 2 2-2 2 2 2-2"],
  database: [
    "M4 6c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3Z",
    "M4 6v6c0 2 3.6 3 8 3s8-1 8-3V6",
    "M4 12v6c0 2 3.6 3 8 3s8-1 8-3v-6",
  ],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  settings: ["M4 6h16M4 12h16M4 18h16", "M8 4v4M16 10v4M10 16v4"],
  search: ["m21 21-4.35-4.35", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z"],
  plus: ["M12 5v14M5 12h14"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  theme: [
    "M12 3a9 9 0 1 0 9 9c0-1.2-.8-2-2-2h-1.5a2 2 0 0 1-2-2V6.5c0-2-1.5-3.5-3.5-3.5Z",
    "M7.5 11h.01M9.5 7h.01M14.5 7h.01",
  ],
  switch: ["M7 7h11l-3-3M17 17H6l3 3", "M18 7v4M6 17v-4"],
  chevron: ["m9 18 6-6-6-6"],
};
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="path in paths[props.name] || paths.diamond" :key="path" :d="path" />
  </svg>
</template>
