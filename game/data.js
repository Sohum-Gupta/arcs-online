import catalogue from "../data/cards.runtime.json" with { type: "json" };
export const CARDS = Object.fromEntries(
  catalogue.map((c) => [
    c.id.replace("ARCS-", ""),
    {
      ...c,
      id: c.id.replace("ARCS-", ""),
      resource: ["Material", "Fuel", "Weapon", "Relic", "Psionic"]
        .find((t) => c.tags.includes(t))
        ?.toLowerCase(),
      kind: c.tags.includes("Guild")
        ? "guild"
        : c.tags.includes("Vox")
          ? "vox"
          : c.tags.includes("Leader")
            ? "leader"
            : c.tags.includes("Lore")
              ? "lore"
              : "reference",
    },
  ]),
);
export const RESOURCES = ["material", "fuel", "weapon", "relic", "psionic"];
export const AMBITIONS = ["tycoon", "tyrant", "warlord", "keeper", "empath"];
export const SUITS = {
  administration: ["tax", "repair", "influence"],
  aggression: ["battle", "move", "secure"],
  construction: ["build", "repair"],
  mobilization: ["move", "influence"],
};
export const COLORS = ["#dc6651", "#e8bd55", "#64a9c9", "#d9d9d4"];
export const PIPS = {
  administration: [4, 4, 3, 3, 3, 2, 1],
  aggression: [3, 3, 2, 2, 2, 2, 1],
  construction: [4, 4, 3, 3, 2, 2, 1],
  mobilization: [4, 4, 3, 3, 2, 2, 1],
};
export const ACTION_CARDS = Object.fromEntries(
  Object.keys(SUITS)
    .flatMap((suit) =>
      PIPS[suit].map((pips, i) => ({
        id: `${suit}-${i + 1}`,
        suit,
        rank: i + 1,
        pips,
        ambition: AMBITIONS[i - 1] ?? null,
      })),
    )
    .map((c) => [c.id, c]),
);
export const DICE = {
  skirmish: [[], [], [], ["hit"], ["hit"], ["hit"]],
  assault: [
    [],
    ["self", "hit"],
    ["intercept", "hit"],
    ["self", "hit", "hit"],
    ["hit", "hit"],
    ["self", "hit"],
  ],
  raid: [
    ["intercept", "key", "key"],
    ["self", "key"],
    ["intercept"],
    ["self", "building"],
    ["building", "key"],
    ["self", "building"],
  ],
};
export const LEADER_SETUP = {
  LEAD01: ["relic", "material", 3, "city", 3, "starport", 2],
  LEAD02: ["psionic", "relic", 3, "city", 3, "starport", 2],
  LEAD03: ["fuel", "fuel", 3, "city", 3, "starport", 2],
  LEAD04: ["psionic", "material", 4, "city", 3, "starport", 2],
  LEAD05: ["material", "weapon", 4, "starport", 4, null, 2],
  LEAD06: ["weapon", "material", 3, "city", 3, "starport", 2],
  LEAD07: ["relic", "material", 3, "city", 3, "city", 3],
  LEAD08: ["psionic", "weapon", 3, "city", 3, "starport", 2],
  LEAD09: ["relic", "relic", 3, "city", 3, "city", 2],
  LEAD10: ["fuel", "material", 3, "city", 3, "starport", 2],
  LEAD11: ["fuel", "weapon", 4, "starport", 3, null, 2],
  LEAD12: ["psionic", "psionic", 3, "city", 3, "starport", 2],
  LEAD13: ["relic", "weapon", 4, null, 3, null, 2],
  LEAD14: ["relic", "material", 3, "city", 3, null, 3],
  LEAD15: ["fuel", "material", 3, "city", 4, "starport", 2],
  LEAD16: ["fuel", "weapon", 4, "starport", 3, null, 2],
};
const planetData = [
  ["weapon", 2, "fuel", 1, "material", 2],
  ["psionic", 1, "weapon", 1, "relic", 2],
  ["material", 1, "fuel", 1, "weapon", 2],
  ["relic", 2, "fuel", 2, "material", 1],
  ["weapon", 1, "relic", 1, "psionic", 2],
  ["material", 1, "fuel", 2, "psionic", 1],
];
export const MAP = Object.fromEntries(
  planetData
    .flatMap((d, j) =>
      ["gate", "arrow", "crescent", "hex"].map((symbol, i) => ({
        id: `${j + 1}-${symbol}`,
        cluster: j + 1,
        symbol,
        resource: i ? d[(i - 1) * 2] : null,
        slots: i ? d[(i - 1) * 2 + 1] : 0,
      })),
    )
    .map((s) => [s.id, s]),
);
export const SETUPS = {
  "3SETUP01": {
    name: "Mix Up",
    players: 3,
    clusters: [2, 3, 5, 6],
    positions: [
      ["3-hex", "5-crescent", "2-gate"],
      ["2-arrow", "5-hex", "3-gate"],
      ["2-hex", "3-arrow", "5-gate"],
    ],
  },
  "3SETUP02": {
    name: "Frontiers",
    players: 3,
    clusters: [1, 4, 5, 6],
    positions: [
      ["1-hex", "4-hex", "6-gate"],
      ["5-hex", "1-crescent", "5-gate"],
      ["4-crescent", "6-arrow", "1-gate"],
    ],
  },
  "3SETUP04": {
    name: "Core Conflict",
    players: 3,
    clusters: [1, 2, 4, 5],
    positions: [
      ["1-hex", "2-crescent", "1-gate"],
      ["2-hex", "1-crescent", "2-gate"],
      ["1-arrow", "2-arrow", "4-gate"],
    ],
  },
  "4SETUP01": {
    name: "Mix Up 1",
    players: 4,
    clusters: [1, 2, 4, 5, 6],
    positions: [
      ["4-arrow", "6-hex", "1-gate"],
      ["4-hex", "5-hex", "6-gate"],
      ["5-arrow", "1-hex", "4-gate"],
      ["6-arrow", "1-arrow", "5-gate"],
    ],
  },
  "4SETUP02": {
    name: "Mix Up 2",
    players: 4,
    clusters: [1, 2, 3, 5, 6],
    positions: [
      ["5-hex", "3-arrow", "2-gate"],
      ["3-hex", "5-crescent", "1-gate"],
      ["2-hex", "1-hex", "3-gate"],
      ["1-arrow", "2-arrow", "5-gate"],
    ],
  },
};
export function adjacent(id, clusters) {
  const s = MAP[id];
  if (!s || !clusters.includes(s.cluster)) return [];
  const c = s.cluster;
  const ids = clusters.toSorted((a, b) => a - b);
  const at = ids.indexOf(c);
  const nearby = {
    gate: [
      `${ids[(at + 1) % ids.length]}-gate`,
      `${ids[(at + ids.length - 1) % ids.length]}-gate`,
      `${c}-arrow`,
      `${c}-crescent`,
      `${c}-hex`,
    ],
    arrow: [
      `${c}-gate`,
      `${c}-crescent`,
      ...(c === 6 && ids.includes(5)
        ? ["5-hex"]
        : c === 3 && ids.includes(2)
          ? ["2-hex"]
          : []),
    ],
    crescent: [`${c}-gate`, `${c}-arrow`, `${c}-hex`],
    hex: [
      `${c}-gate`,
      `${c}-crescent`,
      ...(c === 5 && ids.includes(6)
        ? ["6-arrow"]
        : c === 2 && ids.includes(3)
          ? ["3-arrow"]
          : []),
    ],
  };
  return nearby[s.symbol];
}
export const RESOURCE_KEYS = [3, 1, 1, 2, 1, 3, 4];
Object.assign(SETUPS, {
  "2SETUP01": {
    name: "Frontiers",
    players: 2,
    clusters: [2, 3, 4, 5],
    positions: [
      ["5-hex", "4-hex", "3-gate", "3-arrow"],
      ["3-hex", "5-arrow", "5-gate", "4-arrow"],
    ],
  },
  "2SETUP02": {
    name: "Mix Up 1",
    players: 2,
    clusters: [1, 3, 4, 6],
    positions: [
      ["4-crescent", "3-crescent", "1-gate", "6-arrow"],
      ["6-hex", "3-arrow", "4-gate", "1-hex"],
    ],
  },
  "2SETUP03": {
    name: "Homelands",
    players: 2,
    clusters: [2, 3, 5, 6],
    positions: [
      ["5-arrow", "6-arrow", "5-gate", "5-hex"],
      ["3-arrow", "3-hex", "3-gate", "2-hex"],
    ],
  },
  "2SETUP04": {
    name: "Mix Up 2",
    players: 2,
    clusters: [2, 3, 5, 6],
    positions: [
      ["5-crescent", "2-hex", "3-gate", "6-crescent"],
      ["2-crescent", "6-arrow", "5-gate", "3-arrow"],
    ],
  },
  "3SETUP03": {
    name: "Homelands",
    players: 3,
    clusters: [1, 2, 3, 4],
    positions: [
      ["3-hex", "3-crescent", "3-gate"],
      ["1-hex", "2-hex", "2-gate"],
      ["1-arrow", "4-hex", "4-gate"],
    ],
  },
  "4SETUP03": {
    name: "Frontiers",
    players: 4,
    clusters: [1, 2, 3, 4, 6],
    positions: [
      ["1-hex", "3-crescent", "2-gate"],
      ["3-hex", "6-hex", "3-gate"],
      ["4-crescent", "2-hex", "6-gate"],
      ["1-arrow", "6-arrow", "4-gate"],
    ],
  },
  "4SETUP04": {
    name: "Mix Up 3",
    players: 4,
    clusters: [1, 2, 3, 4, 5],
    positions: [
      ["3-arrow", "5-crescent", "1-gate"],
      ["1-arrow", "3-crescent", "2-gate"],
      ["1-hex", "4-hex", "3-gate"],
      ["4-arrow", "2-crescent", "5-gate"],
    ],
  },
});
