// Lucide ISC; upstream b196797ede8e5ed8894d9fccf9db128072d8abd6
export const lucideIcons: Record<string, Array<[string, Record<string, string>]>> = {
  home: [
    ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }],
    [
      "path",
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      },
    ],
  ],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  "arrow-right": [["path", { d: "M4 12h15m-6-6 6 6-6 6" }]],
  "category-grid": [
    ["path", { d: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" }],
  ],
  activity: [["path", { d: "M2 12h4l3-8 5 16 3-8h5" }]],
  "asin-tag": [
    ["path", { d: "M20 3h-7L3 13l8 8 10-10V4a1 1 0 0 0-1-1Z" }],
    ["circle", { cx: "16.5", cy: "7.5", r: "1" }],
  ],
  "recommendation-award": [
    ["circle", { cx: "12", cy: "9", r: "7" }],
    ["path", { d: "m8 15-2 7 6-3 6 3-2-7M12 6v6M9 9h6" }],
  ],
  // Local analysis glyphs on the same 24px outline grid.
  "product-scan": [
    ["path", { d: "M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" }],
    ["path", { d: "m12 8 4 4-4 4-4-4z" }],
  ],
  "comparison-scales": [
    ["path", { d: "M12 3v18m-4 0h8M4 6h16" }],
    ["path", { d: "m6 6-3 8h6L6 6Zm12 0-3 8h6l-3-8ZM3 14a3 3 0 0 0 6 0m6 0a3 3 0 0 0 6 0" }],
  ],
  info: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 16v-4m0-4h.01" }],
  ],
  "circle-check": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m9 12 2 2 4-4" }],
  ],
  "clipboard-check": [
    ["rect", { x: "8", y: "2", width: "8", height: "4", rx: "1" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2m1 10 2 2 4-4" }],
  ],
  // Local notification glyphs, drawn on the same 24px outline grid.
  "notification-clipboard": [
    ["rect", { x: "8", y: "2", width: "8", height: "4", rx: "1" }],
    ["path", { d: "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 11h8m-8 4h8" }],
  ],
  "notification-trophy": [
    ["path", { d: "M7 3h10v7a5 5 0 0 1-10 0V3Z" }],
    ["path", { d: "M7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4m-5 4v6m-5 0h10" }],
  ],
  "loader-circle-dots": [
    ["circle", { cx: "12", cy: "12", r: "9", "stroke-dasharray": "0.5 6.57", "stroke-width": "3" }],
  ],
  monitor: [
    ["rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }],
    ["path", { d: "M12 17v4m-4 0h8" }],
  ],
  help: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4m.1 3h.01" }],
  ],
  "box-open": [
    ["path", { d: "m12 4 7 3.5 3-2L15 2l-3 2Zm0 0L5 7.5l-3-2L9 2l3 2Zm-7 3.5 7 3.5 7-3.5M5 7.5l-3 4 7 3.5 3-4 3 4 7-3.5-3-4M5 13v5l7 4 7-4v-5m-7-2v11" }],
  ],
  mail: [
    ["rect", { x: "2", y: "4", width: "20", height: "16", rx: "2" }],
    ["path", { d: "m3 6 9 7 9-7" }],
  ],
  smartphone: [
    ["rect", { x: "6", y: "2", width: "12", height: "20", rx: "2" }],
    ["path", { d: "M12 18h.01" }],
  ],
  clock: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 6v6l4 2" }],
  ],
  warning: [["path", { d: "M12 3 2 21h20L12 3ZM12 9v5m0 3h.01" }]],
  layers: [["path", { d: "m12 2 10 5-10 5L2 7l10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5" }]],
  file: [["path", { d: "M5 2h9l5 5v15H5V2Zm9 0v6h5" }]],
  "inbox-download": [
    ["path", { d: "M12 3v11m-4-4 4 4 4-4M3 14v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" }],
  ],
  funnel: [["path", { d: "M3 4h18l-7 8v7l-4-2v-5Z" }]],
  globe: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M2 12h20M12 2c5 5 5 15 0 20-5-5-5-15 0-20Z" }],
  ],
  "map-pin": [
    ["path", { d: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" }],
    ["circle", { cx: "12", cy: "10", r: "2.5" }],
  ],
  trend: [
    ["path", { d: "M16 7h6v6" }],
    ["path", { d: "m22 7-8.5 8.5-5-5L2 17" }],
  ],
  diamond: [
    [
      "path",
      {
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z",
      },
    ],
  ],
  target: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["circle", { cx: "12", cy: "12", r: "6" }],
    ["circle", { cx: "12", cy: "12", r: "2" }],
  ],
  box: [
    [
      "path",
      {
        d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
      },
    ],
    ["path", { d: "m3.3 7 8.7 5 8.7-5" }],
    ["path", { d: "M12 22V12" }],
  ],
  list: [
    ["path", { d: "M3 5h.01" }],
    ["path", { d: "M3 12h.01" }],
    ["path", { d: "M3 19h.01" }],
    ["path", { d: "M8 5h13" }],
    ["path", { d: "M8 12h13" }],
    ["path", { d: "M8 19h13" }],
  ],
  bell: [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }],
    [
      "path",
      {
        d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
      },
    ],
  ],
  automation: [
    ["path", { d: "M14 17H5" }],
    ["path", { d: "M19 7h-9" }],
    ["circle", { cx: "17", cy: "17", r: "3" }],
    ["circle", { cx: "7", cy: "7", r: "3" }],
  ],
  chart: [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }],
    ["path", { d: "M18 17V9" }],
    ["path", { d: "M13 17V5" }],
    ["path", { d: "M8 17v-3" }],
  ],
  person: [
    ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: "12", cy: "7", r: "4" }],
  ],
  building: [
    ["path", { d: "M12 10h.01" }],
    ["path", { d: "M12 14h.01" }],
    ["path", { d: "M12 6h.01" }],
    ["path", { d: "M16 10h.01" }],
    ["path", { d: "M16 14h.01" }],
    ["path", { d: "M16 6h.01" }],
    ["path", { d: "M8 10h.01" }],
    ["path", { d: "M8 14h.01" }],
    ["path", { d: "M8 6h.01" }],
    ["path", { d: "M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" }],
    ["rect", { x: "4", y: "2", width: "16", height: "20", rx: "2" }],
  ],
  users: [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
    ["path", { d: "M16 3.128a4 4 0 0 1 0 7.744" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }],
    ["circle", { cx: "9", cy: "7", r: "4" }],
  ],
  key: [
    ["path", { d: "m2 21 9.6-9.6" }],
    ["path", { d: "m7.5 15.5 2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19" }],
    ["circle", { cx: "15.5", cy: "7.5", r: "5.5" }],
  ],
  database: [
    ["ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }],
    ["path", { d: "M3 5V19A9 3 0 0 0 21 19V5" }],
    ["path", { d: "M3 12A9 3 0 0 0 21 12" }],
  ],
  shield: [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
      },
    ],
    ["path", { d: "m9 12 2 2 4-4" }],
  ],
  settings: [
    ["path", { d: "M14 17H5" }],
    ["path", { d: "M19 7h-9" }],
    ["circle", { cx: "17", cy: "17", r: "3" }],
    ["circle", { cx: "7", cy: "7", r: "3" }],
  ],
  refresh: [["path", { d: "M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 11-2l3 6M4 12l3 6a7 7 0 0 0 11-2" }]],
  search: [
    ["path", { d: "m21 21-4.34-4.34" }],
    ["circle", { cx: "11", cy: "11", r: "8" }],
  ],
  plus: [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "M12 5v14" }],
  ],
  menu: [
    ["path", { d: "M4 5h16" }],
    ["path", { d: "M4 12h16" }],
    ["path", { d: "M4 19h16" }],
  ],
  theme: [
    [
      "path",
      {
        d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
      },
    ],
    ["circle", { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor" }],
    ["circle", { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor" }],
    ["circle", { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor" }],
    ["circle", { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor" }],
  ],
  switch: [
    ["path", { d: "M8 3 4 7l4 4" }],
    ["path", { d: "M4 7h16" }],
    ["path", { d: "m16 21 4-4-4-4" }],
    ["path", { d: "M20 17H4" }],
  ],
  chevron: [["path", { d: "m9 18 6-6-6-6" }]],
};
