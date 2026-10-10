import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  decision,
  transition,
  viewFor,
  control,
  pool,
  capacity,
  resourceKeysFor,
  place,
  assertInvariants,
  ambitionValues,
  scoreAmbition,
} from "../game/engine.js";
import {
  CARDS,
  ACTION_CARDS,
  DICE,
  MAP,
  SETUPS,
  LEADER_SETUP,
  RESOURCES,
  adjacent,
} from "../game/data.js";
function settle(s) {
  let n = 0;
  while (s.pending[0]?.type === "arrangeResources" && n++ < 20) {
    const p = s.pending[0].p;
    s = transition(s, p, {
      choice: decision(s, p).choices.find((c) => c.op === "skip").id,
    });
  }
  return s;
}
function fixture() {
  let s = settle(
    createGame(
      ["A", "B", "C", "D"],
      { initiative: 0, setupId: "4SETUP01" },
      37,
    ),
  );
  s.phase = "turn";
  s.turn = {
    card: s.players[0].hand[0],
    suit: "administration",
    pips: 4,
    mode: "lead",
    prelude: true,
    acted: false,
    declared: false,
    taxed: [],
    built: [],
    used: [],
    weapons: false,
  };
  s.current = 0;
  s.lead = { ...ACTION_CARDS["administration-2"], rank: 2, player: 0 };
  return s;
}
function choose(s, op, filter = () => true, p = s.pending[0]?.p ?? s.current) {
  const d = decision(s, p),
    c = d.choices.find((c) => c.op === op && filter(c));
  assert.ok(c, `Missing ${op}: ${d.title} ${JSON.stringify(d.choices)}`);
  return settle(transition(s, p, { choice: c.id }));
}
function form(s, value, p = s.pending[0]?.p ?? s.current) {
  return settle(transition(s, p, { value }));
}
function task(s, t) {
  s.pending = [{ p: 0, ...t }];
  return s;
}
function own(s, id, p = 0) {
  for (const pl of s.players) pl.cards = pl.cards.filter((c) => c !== id);
  s.courtDeck = s.courtDeck.filter((c) => c !== id);
  s.courtDiscard = s.courtDiscard.filter((c) => c !== id);
  for (const lane of s.court) if (lane.id === id) lane.id = null;
  s.players[p].cards.push(id);
  return s;
}
function resources(s, p, rs) {
  for (const r of s.players[p].resources) if (r) s.supply[r]++;
  s.players[p].resources = Array(capacity(s, p)).fill(null);
  rs.forEach((r, i) => {
    assert.ok(s.supply[r] > 0);
    s.supply[r]--;
    s.players[p].resources[i] = r;
  });
  return s;
}
function clear(s) {
  s.pieces = [];
  for (const p of s.players) resources(s, p.id, []);
  return s;
}
function act(s, a, targetOp, pred = () => true, cost = "pip") {
  s = choose(s, "action", (c) => c.action === a && c.cost === cost);
  return choose(s, targetOp, pred);
}
function diceState() {
  let s = clear(fixture());
  const sys = "1-arrow";
  place(s, 0, "ship", sys, 3);
  place(s, 1, "ship", sys, 2);
  place(s, 1, "city", sys);
  return task(s, {
    type: "dice",
    system: sys,
    defender: 1,
    attackers: s.pieces.filter((x) => x.owner === 0).map((x) => x.id),
    allFresh: true,
  });
}

test("all official base/LL content and action cards are present", () => {
  const cs = Object.values(CARDS).filter((c) => c.product !== "blightedreach");
  assert.equal(cs.length, 87);
  assert.equal(cs.filter((c) => c.kind === "leader").length, 16);
  assert.equal(cs.filter((c) => c.kind === "lore").length, 28);
  assert.equal(cs.filter((c) => c.kind === "guild").length, 25);
  assert.equal(cs.filter((c) => c.kind === "vox").length, 6);
  assert.equal(Object.keys(ACTION_CARDS).length, 28);
  assert.equal(Object.keys(SETUPS).length, 12);
});
for (const [id, set] of Object.entries(SETUPS))
  test(`official setup ${id}: legal clusters, pieces, hands, finite supplies`, () => {
    const s = createGame(
      ["A", "B", "C", "D"].slice(0, set.players),
      { setupId: id, initiative: 0 },
      52,
    );
    assertInvariants(s);
    assert.equal(s.court.length, set.players === 2 ? 3 : 4);
    for (const p of s.players) {
      assert.equal(p.hand.length, 6);
      assert.equal(
        s.pieces.filter((x) => x.owner === p.id && x.type === "ship").length,
        set.players === 2 ? 10 : 8,
      );
      assert.equal(pool(s, p.id, "city"), 4);
      assert.equal(pool(s, p.id, "starport"), 4);
    }
    if (set.players !== 4)
      assert.ok(
        s.players
          .flatMap((p) => p.hand)
          .every((c) => ![1, 7].includes(ACTION_CARDS[c].rank)),
      );
  });
for (const id of Object.keys(LEADER_SETUP))
  test(`${id} ${CARDS[id].name}: full draft, setup and supply conservation`, () => {
    let s = createGame(["A", "B", "C"], { leaders: true, initiative: 0 }, 29);
    s.draft.leaders = [
      id,
      ...Object.keys(LEADER_SETUP)
        .filter((x) => x !== id)
        .slice(0, 3),
    ];
    let n = 0;
    while (s.phase === "draft" && n++ < 20) {
      const p = s.current,
        d = decision(s, p);
      const c = d.choices.find((c) => c.card === id) ?? d.choices[0];
      s = transition(s, p, { choice: c.id });
    }
    s = settle(s);
    while (s.pending[0]?.type === "archivist") s = choose(s, "take");
    assertInvariants(s);
    const pl = s.players.find((p) => p.leader === id);
    assert.ok(pl);
    assert.equal(pl.cards.length, id === "LEAD09" ? 3 : 1);
    if (id === "LEAD02") assert.deepEqual(pl.outrage, ["material", "fuel"]);
    if (id === "LEAD10") assert.deepEqual(pl.scrap, { ship: 2, agent: 3 });
    if (id === "LEAD13") assert.equal(pl.scrap.city, 2);
    if (id === "LEAD16") assert.deepEqual(pl.outrage, ["material"]);
  });
test("control counts fresh ships only and ties remove control", () => {
  let s = clear(fixture());
  place(s, 0, "ship", "1-gate", 2);
  place(s, 1, "ship", "1-gate", 1);
  assert.equal(control(s, "1-gate"), 0);
  s.pieces[0].damaged = true;
  assert.equal(control(s, "1-gate"), null);
  s.pieces[1].damaged = true;
  assert.equal(control(s, "1-gate"), 1);
});
test("every adjacency is reciprocal and excludes closed sectors", () => {
  for (const setup of Object.values(SETUPS))
    for (const id of Object.keys(MAP).filter((x) =>
      setup.clusters.includes(MAP[x].cluster),
    ))
      for (const next of adjacent(id, setup.clusters)) {
        assert.ok(setup.clusters.includes(MAP[next].cluster));
        assert.ok(adjacent(next, setup.clusters).includes(id), `${id}/${next}`);
      }
});
test("unavailable actions and wrong actors reject transactionally", () => {
  const s = fixture(),
    original = structuredClone(s);
  assert.throws(() => transition(s, 1, { choice: 0 }), /turn/);
  assert.throws(() => transition(s, 0, { choice: 99999 }), /available/);
  assert.deepEqual(s, original);
});
test("private views hide rival hands, face-down cards, deck order and RNG", () => {
  let s = fixture();
  s.played = [{ player: 1, card: "aggression-1", mode: "copy", faceup: false }];
  const v = viewFor(s, 0);
  assert.equal(typeof v.players[1].hand, "number");
  assert.equal(v.played[0].card, null);
  for (const key of ["rng", "courtDeck", "discard", "pending"])
    assert.equal(v[key], undefined);
  assert.equal(v.players[0].hand.length, 6);
});
test("copy, pivot and surpass obey suit and rank; pips match physical cards", () => {
  let s = fixture();
  s.phase = "card";
  s.turn = null;
  s.players[0].hand = ["administration-1", "administration-3", "aggression-4"];
  s.discard = [];
  s.players.slice(1).forEach((p) => (p.hand = []));
  const cs = decision(s, 0).choices;
  assert.ok(
    !cs.some((c) => c.card === "administration-1" && c.mode === "surpass"),
  );
  assert.ok(
    cs.some((c) => c.card === "administration-3" && c.mode === "surpass"),
  );
  assert.ok(cs.some((c) => c.card === "aggression-4" && c.mode === "pivot"));
  assert.equal(choose(s, "play", (c) => c.mode === "copy").turn.pips, 1);
  assert.equal(
    choose(s, "play", (c) => c.mode === "surpass").turn.pips,
    ACTION_CARDS["administration-3"].pips,
  );
});
test("declaring takes the highest marker, zeroes lead, can stack ambition", () => {
  let s = fixture();
  s.turn.card = "administration-2";
  s = choose(s, "declare");
  assert.equal(s.markers[2].ambition, "tycoon");
  assert.equal(s.lead.rank, 0);
  assert.ok(!decision(s, 0).choices.some((c) => c.op === "declare"));
});
test("BC18 Secret Order preserves lead rank on Keeper declaration", () => {
  let s = own(fixture(), "BC18");
  s.turn.card = "administration-5";
  s = choose(s, "declare");
  assert.equal(s.lead.rank, 2);
  assert.equal(s.markers[2].ambition, "keeper");
});
test("BC25 Galactic Bards allow Pivot declaration only before actions and once per round", () => {
  let s = own(fixture(), "BC25");
  s.turn.mode = "pivot";
  s.turn.card = "aggression-4";
  assert.ok(decision(s, 0).choices.some((c) => c.op === "declare"));
  s.roundDeclared = true;
  assert.ok(!decision(s, 0).choices.some((c) => c.op === "declare"));
});
test("resource Prelude is held outside supply, then returned at first pip", () => {
  let s = resources(fixture(), 0, ["material"]);
  const supply = s.supply.material;
  s = choose(s, "action", (c) => c.action === "build" && c.cost === 0);
  s = choose(s, "buildTarget", (c) => c.kind === "ship");
  assert.equal(s.supply.material, supply);
  assert.deepEqual(s.held, ["material"]);
  s = act(
    s,
    "tax",
    "taxTarget",
    (c) => s.pieces.find((x) => x.id === c.piece)?.owner === 0,
  );
  assert.equal(s.held.length, 0);
  assert.equal(s.turn.prelude, false);
  assert.ok(!decision(s, 0).choices.some((c) => typeof c.cost === "number"));
});
for (const [id, r, a] of [
  ["BC01", "material", "build"],
  ["BC07", "fuel", "move"],
  ["BC15", "weapon", "weapons"],
  ["BC19", "psionic", "tax"],
  ["BC21", "relic", "secure"],
])
  test(`${id} converts another resource and ignores its Outrage`, () => {
    let s = resources(own(fixture(), id), 0, ["relic"]);
    s.players[0].outrage = [r];
    if (a === "secure") s.court[0].agents[0] = 1;
    assert.ok(
      decision(s, 0).choices.some(
        (c) => c.cost === 0 && (c.action === a || c.op === a),
      ),
    );
  });
test("tax city once per turn, capture only rival supply agents", () => {
  let s = clear(fixture());
  place(s, 0, "ship", "1-arrow", 2);
  const id = place(s, 1, "city", "1-arrow")[0];
  s = act(s, "tax", "taxTarget", (c) => c.piece === id);
  assert.equal(s.players[0].captives.length, 1);
  assert.ok(
    !decision(s, 0).choices.some((c) => c.action === "tax" && c.cost === "pip"),
  );
});
test("build damaged under rival control; one ship build per starport", () => {
  let s = clear(fixture());
  place(s, 1, "ship", "1-arrow");
  const port = place(s, 0, "starport", "1-arrow")[0];
  s.turn.suit = "construction";
  s = act(s, "build", "buildTarget", (c) => c.port === port);
  assert.equal(
    s.pieces.find((x) => x.owner === 0 && x.type === "ship").damaged,
    true,
  );
  s = choose(s, "action", (c) => c.action === "build");
  assert.ok(!decision(s, 0).choices.some((c) => c.port === port));
});
test("secure needs strict influence majority and captures rival agents", () => {
  let s = fixture();
  s.turn.suit = "aggression";
  s.court[0].agents = [2, 1, 0, 0];
  const id = s.court[0].id;
  s = act(s, "secure", "secureTarget", (c) => c.index === 0);
  assert.ok(s.players[0].cards.includes(id) || CARDS[id].kind === "vox");
  assert.equal(s.players[0].captives.length, 1);
  assert.equal(s.court[0].agents[0], 0);
});
test("ambition scoring handles first ties, second ties, zero, neutral", () => {
  let s = fixture();
  s.markers[2].ambition = "warlord";
  s.players.forEach(
    (p, i) =>
      (p.trophies = Array([3, 3, 1, 0][i]).fill({ owner: 2, type: "ship" })),
  );
  assert.deepEqual(scoreAmbition(s, "warlord"), [3, 3, 0, 0]);
  s.players[0].trophies.push({ owner: 2, type: "ship" });
  s.players[2].trophies.push(
    { owner: 2, type: "ship" },
    { owner: 2, type: "ship" },
  );
  assert.deepEqual(scoreAmbition(s, "warlord"), [5, 0, 0, 0]);
});
for (const [leader, a] of [
  ["LEAD01", "tyrant"],
  ["LEAD06", "empath"],
  ["LEAD09", "tycoon"],
])
  test(`${leader} scoring penalty`, () => {
    let s = fixture();
    s.players[0].leader = leader;
    s.markers[2].ambition = a;
    resources(s, 0, ["psionic", "psionic", "material"]);
    resources(s, 1, []);
    resources(s, 2, []);
    resources(s, 3, []);
    s.players[0].captives = [{ owner: 1, type: "agent" }];
    assert.equal(scoreAmbition(s, a)[0], 3);
  });
test("LEAD12 Noble receives no tied first Power", () => {
  let s = fixture();
  s.players[0].leader = "LEAD12";
  s.markers[2].ambition = "warlord";
  s.players[0].trophies = [{ owner: 1, type: "ship" }];
  s.players[1].trophies = [{ owner: 2, type: "ship" }];
  assert.equal(scoreAmbition(s, "warlord")[0], 0);
});
for (const [id, r] of [
  ["BC03", "material"],
  ["BC06", "fuel"],
])
  test(`${id} cartel supply counts toward Tycoon`, () => {
    let s = own(fixture(), id);
    const without = structuredClone(s);
    without.players[0].cards = [];
    assert.equal(
      ambitionValues(s, "tycoon")[0] - ambitionValues(without, "tycoon")[0],
      1 + s.supply[r],
    );
  });
for (const [id, r] of [
  ["BC02", "material"],
  ["BC09", "fuel"],
])
  test(`${id} alternative Build produces ${r}`, () => {
    let s = resources(own(fixture(), id), 0, []);
    s.turn.suit = "construction";
    s = choose(s, "action", (c) => c.action === "build" && c.cost === "pip");
    s = choose(s, "special", (c) => c.card === id);
    s = choose(s, "manufacture");
    assert.ok(s.players[0].resources.includes(r));
    assert.equal(s.turn.pips, 3);
  });
for (const [id, suit] of [
  ["BC04", "administration"],
  ["BC05", "construction"],
  ["BC10", "mobilization"],
  ["BC11", "aggression"],
])
  test(`${id} Union targets face-up matching cards only`, () => {
    let s = own(fixture(), id);
    s.played = [
      { card: `${suit}-3`, faceup: true, player: 1, mode: "surpass" },
      { card: `${suit}-4`, faceup: false, player: 2, mode: "copy" },
    ];
    for (const p of s.players)
      p.hand = p.hand.filter((c) => !s.played.some((v) => v.card === c));
    s.discard = s.discard.filter((c) => !s.played.some((v) => v.card === c));
    s = choose(s, "guild", (c) => c.card === id);
    assert.deepEqual(
      decision(s, 0)
        .choices.filter((c) => c.op === "union")
        .map((c) => c.target),
      [`${suit}-3`],
    );
  });
test("BC17 Farseers draws from a short discard after shuffling selected cards into it", () => {
  let s = task(fixture(), { type: "farseersDiscard" });
  s.players.forEach((p) => (p.hand = []));
  s.players[0].hand = ["administration-1", "administration-2"];
  s.discard = ["aggression-1"];
  s = form(s, ["administration-1", "administration-2"]);
  assert.equal(s.players[0].hand.length, 3);
  assert.equal(s.players[0].hand[0], "aggression-1");
  assert.equal(s.discard.length, 0);
});
test("BC16 Lattice can be discarded when initiative cannot be seized", () => {
  let s = own(fixture(), "BC16");
  s = choose(s, "guild", (c) => c.card === "BC16");
  assert.ok(!s.players[0].cards.includes("BC16"));
  assert.equal(s.initiative, 0);
});
test("BC24 Relic Fence is limited to once per turn", () => {
  let s = resources(own(fixture(), "BC24"), 0, ["fuel"]);
  s = choose(s, "guild", (c) => c.card === "BC24");
  s = choose(s, "fence");
  assert.ok(s.players[0].resources.includes("relic"));
  assert.ok(
    !decision(s, 0).choices.some((c) => c.card === "BC24" && c.op === "guild"),
  );
});
test("BC22 Sworn Guardians must be stolen first and are buried", () => {
  let s = own(diceState(), "BC22", 1);
  s = own(s, "BC01", 1);
  s = task(s, { type: "raid", defender: 1, system: "1-arrow", keys: 10 });
  const cs = decision(s, 0).choices.filter((c) => c.op !== "skip");
  assert.equal(cs.length, 1);
  assert.equal(cs[0].card, "BC22");
  s = choose(s, "stealCard");
  assert.equal(s.courtDeck.at(-1), "BC22");
  assert.ok(
    decision(s, 0).choices.some(
      (c) => c.op === "stealResource" || c.card === "BC01",
    ),
  );
});
test("BC30 Guild Struggle still reshuffles guild discards when theft is declined", () => {
  let s = own(fixture(), "BC30");
  s.court[0].id = null;
  s.courtDiscard = ["BC01", "BC28"];
  s.courtDeck = s.courtDeck.filter((id) => !["BC01", "BC28"].includes(id));
  s = task(s, { type: "vox", id: "BC30", index: 0 });
  s = choose(s, "skip");
  assert.ok(!s.courtDiscard.includes("BC01"));
  assert.ok(s.courtDiscard.includes("BC30"));
  assert.ok(s.courtDiscard.includes("BC28"));
});
test("BC29 Song of Freedom initiative seizure remains optional", () => {
  let s = own(fixture(), "BC29");
  s.initiative = 1;
  s.court[0].id = null;
  s = task(s, { type: "vox", id: "BC29", index: 0 });
  s = choose(s, "freedom");
  assert.equal(s.pending[0].type, "freedomSeize");
  s = choose(s, "skip");
  assert.equal(s.initiative, 1);
});
test("LEAD05 Rebel requires extra two dice, with finite dice supply", () => {
  let s = diceState();
  s.players[0].leader = "LEAD05";
  assert.equal(decision(s, 0).form.min, 2);
  assert.equal(decision(s, 0).form.max, 5);
  assert.throws(() => form(s, { skirmish: 1, assault: 0, raid: 0 }), /extra/);
  assert.throws(
    () => form(s, { skirmish: 6, assault: 0, raid: 0 }),
    /Too many/,
  );
  assert.equal(
    form(s, { skirmish: 2, assault: 0, raid: 0 }).lastBattle.dice.length,
    2,
  );
});
test("LEAD11 Corsair rejects more assault than skirmish dice", () => {
  let s = diceState();
  s.players[0].leader = "LEAD11";
  assert.throws(() => form(s, { skirmish: 0, assault: 1, raid: 0 }), /Corsair/);
});
test("L04 Mirror Plating intercept is not removed by L06 Signal Breaker", () => {
  let s = own(own(diceState(), "L06"), "L04", 1);
  s.pending[0] = {
    ...s.pending[0],
    type: "reroll",
    dice: [{ type: "assault", faces: [] }],
    used: [],
    allFresh: true,
  };
  s = choose(s, "resolve");
  assert.equal(s.pending[0].type, "hits");
  assert.equal(s.pending[0].target, 0);
  assert.equal(s.pending[0].left, 2);
});
test("L05 Hidden Harbors prohibits all raid dice against fresh port", () => {
  let s = own(diceState(), "L05", 1);
  place(s, 1, "starport", "1-arrow");
  assert.equal(decision(s, 0).form.raidMax, 0);
  assert.throws(() => form(s, { skirmish: 0, assault: 0, raid: 1 }), /Raid/);
});
test("L17 Raider Exosuits allows only one raid against building-free system", () => {
  let s = diceState();
  s.pieces.find((x) => x.type === "city").system = "1-hex";
  assert.equal(decision(s, 0).form.raidMax, 0);
  own(s, "L17");
  assert.equal(decision(s, 0).form.raidMax, 1);
});
test("new ships placed during a battle cannot absorb attacking hits", () => {
  let s = diceState();
  const attackers = s.pending[0].attackers;
  const fresh = place(s, 0, "ship", "1-arrow")[0];
  s = task(s, {
    type: "hits",
    system: "1-arrow",
    target: 0,
    dealer: 1,
    left: 1,
    kind: "self",
    battle: true,
    attackers,
  });
  assert.ok(!decision(s, 0).choices.some((c) => c.piece === fresh));
});
test("L13 Ancient Holdings has fixed four-key slot after current board slots", () => {
  let s = clear(own(fixture(), "L13"));
  assert.equal(capacity(s, 0), 3);
  assert.deepEqual(resourceKeysFor(s, 0), [3, 1, 4]);
  place(s, 0, "city", "1-arrow");
  assert.deepEqual(resourceKeysFor(s, 0), [3, 1, 1, 4]);
});
test("L11 Gate Stations can tax an untyped gate city for a captive", () => {
  let s = clear(own(fixture(), "L11"));
  place(s, 0, "ship", "1-gate");
  const city = place(s, 1, "city", "1-gate")[0];
  s = act(s, "tax", "taxTarget", (c) => c.piece === city);
  assert.equal(s.players[0].captives.length, 1);
});
test("L18 Survival Overrides permits sacrificing without a rival target", () => {
  let s = own(fixture(), "L18");
  s.turn.suit = "mobilization";
  s = choose(s, "action", (c) => c.action === "move" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "L18");
  const before = s.pieces.length;
  s = choose(s, "martyr", (c) => !c.target);
  assert.equal(s.pieces.length, before - 1);
});
test("L22 Keeper’s Solidarity protects material guilds using cartel supply", () => {
  let s = own(own(own(diceState(), "L22", 1), "BC03", 1), "BC01", 1);
  resources(s, 1, []);
  s.markers[2].ambition = "keeper";
  task(s, { type: "steal" });
  assert.ok(
    !decision(s, 0).choices.some(
      (c) => c.defender === 1 && c.op === "stealCard",
    ),
  );
});
for (const id of ["L19", "L21", "L23", "L25", "L28"])
  test(`${id} discard clears matching Outrage`, () => {
    let s = own(fixture(), id);
    s.players[0].outrage = [
      {
        L19: "psionic",
        L21: "relic",
        L23: "weapon",
        L25: "weapon",
        L28: "material",
      }[id],
    ];
    s = choose(s, "guild", (c) => c.card === id);
    s = choose(s, "clearOutrage");
    assert.deepEqual(s.players[0].outrage, []);
    assert.ok(!s.players[0].cards.includes(id));
  });
test("resource rearrangement is allowed after gain, not arbitrarily in turn", () => {
  let s = fixture();
  assert.ok(!decision(s, 0).choices.some((c) => c.op === "reorder"));
  s = task(s, { type: "gainChoice", count: 1 });
  const c = decision(s, 0).choices.find((c) => c.op === "gain");
  s = transition(s, 0, { choice: c.id });
  assert.equal(s.pending[0].type, "arrangeResources");
});
test("LEAD07 bonus influence is rolled back if Secure remains illegal", () => {
  let s = fixture();
  s.players[0].leader = "LEAD07";
  s.turn.suit = "aggression";
  s.turn.mode = "copy";
  s.turn.pips = 1;
  s.court.forEach((c) => (c.agents = [0, 2, 0, 0]));
  s = choose(s, "action", (c) => c.action === "secure" && c.cost === "pip");
  s = choose(s, "bonusBefore");
  s = choose(s, "influenceTarget");
  assert.ok(s.court.every((c) => c.agents[0] === 0));
  assert.equal(s.turn.pips, 1);
  assert.match(s.log.at(-1).text, /undone/);
});
test("LEAD12 declaration draws exactly one court card without refilling invisible lane", () => {
  let s = fixture();
  s.players[0].leader = "LEAD12";
  s.turn.card = "administration-2";
  const guild = s.courtDeck.find((id) => CARDS[id].kind === "guild");
  s.courtDeck = [guild, ...s.courtDeck.filter((id) => id !== guild)];
  const n = s.courtDeck.length;
  s = choose(s, "declare");
  assert.equal(s.courtDeck.length, n - 1);
  assert.ok(s.players[0].cards.includes(guild));
  assert.ok(
    !decision(s, 0).choices.some((c) => c.op === "guild" && c.card === guild),
  );
});
for (const [leader, r] of [
  ["LEAD02", "psionic"],
  ["LEAD03", "fuel"],
  ["LEAD15", "weapon"],
])
  test(`${leader} copied tax grants its extra resource`, () => {
    let s = resources(fixture(), 0, []);
    s.players[0].leader = leader;
    s.turn.mode = "copy";
    s = act(
      s,
      "tax",
      "taxTarget",
      (c) => s.pieces.find((x) => x.id === c.piece)?.owner === 0,
    );
    assert.ok(s.players[0].resources.includes(r));
  });
test("LEAD04 Upstart cannot tax uncontrolled loyal cities and gains a declaration resource", () => {
  let s = clear(fixture());
  s.players[0].leader = "LEAD04";
  place(s, 0, "city", "1-arrow");
  assert.ok(!decision(s, 0).choices.some((c) => c.action === "tax"));
  s.turn.card = "administration-2";
  s = choose(s, "declare");
  assert.equal(s.pending[0].type, "gainChoice");
  s = choose(s, "gain", (c) => c.resource === "material");
  assert.ok(s.players[0].resources.includes("material"));
});
test("LEAD08 Demagogue needs two agents for Guild secure but one for Vox", () => {
  let s = fixture();
  s.players[0].leader = "LEAD08";
  s.turn.suit = "aggression";
  s.court[0].id = "BC01";
  s.court[0].agents = [1, 0, 0, 0];
  s.court[1].id = "BC26";
  s.court[1].agents = [1, 0, 0, 0];
  s = choose(s, "action", (c) => c.action === "secure" && c.cost === "pip");
  assert.ok(!decision(s, 0).choices.some((c) => c.index === 0));
  assert.ok(decision(s, 0).choices.some((c) => c.index === 1));
});
test("LEAD13 Anarchist taxes an empty slot and cannot tax loyal cities", () => {
  let s = clear(fixture());
  s.players[0].leader = "LEAD13";
  place(s, 0, "ship", "1-arrow");
  place(s, 0, "city", "1-arrow");
  s = choose(s, "action", (c) => c.action === "tax" && c.cost === "pip");
  assert.ok(decision(s, 0).choices.some((c) => c.empty));
  assert.ok(!decision(s, 0).choices.some((c) => c.piece));
  s = choose(s, "taxTarget");
  assert.ok(s.players[0].resources.includes("weapon"));
});
test("LEAD14 Shaper can permanently change a planet using cartel material", () => {
  let s = clear(own(fixture(), "BC03"));
  s.players[0].leader = "LEAD14";
  s = task(s, { type: "mythic", system: "1-arrow" });
  const before = s.supply.material;
  s = choose(s, "mythic", (c) => c.resource === "material");
  assert.equal(s.overrides["1-arrow"], "material");
  assert.equal(s.supply.material, before - 1);
  assertInvariants(s);
});
test("LEAD10 Overseer repeats a tax by damaging its building", () => {
  let s = resources(fixture(), 0, []);
  s.players[0].leader = "LEAD10";
  const city = s.pieces.find((x) => x.owner === 0 && x.type === "city");
  s = act(s, "tax", "taxTarget", (c) => c.piece === city.id);
  s = choose(s, "ruthless");
  assert.equal(s.players[0].resources.filter(Boolean).length, 2);
  assert.ok(s.pieces.find((x) => x.id === city.id).damaged);
  assert.ok(s.turn.used.includes("ruthless"));
});
test("LEAD15 Agitator replaces interception with weapon icons and discards one weapon", () => {
  let s = resources(own(diceState(), "BC15", 1), 1, ["weapon"]);
  s.players[1].leader = "LEAD15";
  s.pending[0] = {
    ...s.pending[0],
    type: "reroll",
    dice: [{ type: "assault", faces: ["intercept"] }],
    used: [],
    allFresh: true,
  };
  s = choose(s, "resolve");
  assert.equal(s.pending[0].left, 2);
  assert.equal(s.players[1].resources.filter((r) => r === "weapon").length, 0);
});
test("LEAD16 Quartermaster repairs based on controlled rival starports too", () => {
  let s = diceState();
  s.players[0].leader = "LEAD16";
  place(s, 0, "ship", "1-arrow");
  s.pieces.find((x) => x.owner === 0).damaged = true;
  place(s, 2, "starport", "1-arrow");
  s = task(s, {
    type: "reroll",
    defender: 1,
    system: "1-arrow",
    dice: [],
    used: [],
    beforeTrophies: 0,
  });
  s = choose(s, "resolve");
  assert.equal(s.pending[0].type, "repairBonus");
  s = choose(s, "repairBonus");
  assert.ok(s.pieces.filter((x) => x.owner === 0).every((x) => !x.damaged));
});
test("L01 Tool-Priests summons at controlled rival cities once per turn", () => {
  let s = clear(own(fixture(), "L01"));
  place(s, 0, "ship", "1-arrow");
  place(s, 1, "city", "1-arrow");
  s.turn.suit = "construction";
  s = choose(s, "action", (c) => c.action === "build" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "L01");
  s = choose(s, "summon");
  assert.equal(
    s.pieces.filter((x) => x.owner === 0 && x.type === "ship").length,
    2,
  );
  assert.ok(s.turn.used.includes("L01"));
});
test("L02 Galactic Rifles use fresh ships and ignore battle-only reroll modifiers", () => {
  let s = clear(own(own(fixture(), "L02"), "BC13"));
  place(s, 0, "ship", "1-arrow", 2);
  s.pieces[0].damaged = true;
  place(s, 1, "ship", "1-gate");
  s.turn.suit = "aggression";
  s = choose(s, "action", (c) => c.action === "battle" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "L02");
  s = choose(s, "rifles");
  assert.equal(
    decision(s, 0).choices.filter((c) => c.op === "rifleDice").length,
    2,
  );
  s = choose(s, "rifleDice", (c) => c.n === 1);
  assert.notEqual(s.pending[0]?.type, "reroll");
});
test("L03 Sprinter Drives moves grouped fresh ships; damaged ships get no extra move", () => {
  let s = clear(own(fixture(), "L03"));
  const ids = place(s, 0, "ship", "1-arrow", 3);
  s.pieces[2].damaged = true;
  s.turn.suit = "mobilization";
  s = act(s, "move", "moveFrom", (c) => c.system === "1-arrow");
  s = form(s, ids);
  s = choose(s, "moveTo", (c) => c.system === "1-gate");
  s = choose(s, "sprint");
  const opts = decision(s, 0).form.options;
  assert.equal(opts.length, 2);
  s = form(
    s,
    opts.map((x) => x.id),
  );
  s = choose(s, "moveTo", (c) => c.system === "1-hex");
  assert.equal(s.pieces.filter((x) => x.system === "1-hex").length, 2);
  assert.equal(s.pieces.find((x) => x.damaged).system, "1-gate");
});
test("L08 Gate Ports captures once per group entering a controlled gate", () => {
  let s = clear(own(fixture(), "L08", 1));
  const ids = place(s, 0, "ship", "1-arrow", 2);
  place(s, 1, "ship", "1-gate", 3);
  place(s, 1, "starport", "1-gate");
  s.turn.suit = "mobilization";
  s = act(s, "move", "moveFrom", (c) => c.system === "1-arrow");
  s = form(s, ids);
  s = choose(s, "moveTo", (c) => c.system === "1-gate");
  assert.equal(s.players[1].captives.length, 1);
});
test("L09 Cloud Cities cannot spend the same token for the action and cloud cost", () => {
  let s = clear(own(fixture(), "L09"));
  place(s, 0, "ship", "1-hex");
  resources(s, 0, ["material"]);
  s = choose(s, "action", (c) => c.action === "build" && c.cost === 0);
  assert.ok(!decision(s, 0).choices.some((c) => c.op === "cloudTarget"));
  s = fixture();
  own(s, "L09");
  s.turn.suit = "construction";
  resources(s, 0, ["relic"]);
  s = choose(s, "action", (c) => c.action === "build" && c.cost === "pip");
  s = choose(s, "cloudTarget");
  s = choose(s, "cloudPay");
  assert.ok(s.pieces.some((x) => x.cloud));
  assert.equal(s.players[0].resources.filter(Boolean).length, 0);
});
test("L10 Living Structures Prune preserves damaged status and returns original piece", () => {
  let s = clear(own(fixture(), "L10"));
  place(s, 0, "starport", "1-arrow", 1, true);
  s.turn.suit = "construction";
  s = choose(s, "action", (c) => c.action === "repair" && c.cost === "pip");
  s = choose(s, "special");
  s = choose(s, "prune");
  assert.equal(s.pieces[0].type, "city");
  assert.equal(s.pieces[0].damaged, true);
});
test("L12 Railgun hit occurs before collecting dice, while Signal Breaker records initial freshness", () => {
  let s = own(own(diceState(), "L12", 1), "L06");
  s.pending = [];
  s.turn.suit = "aggression";
  s = act(s, "battle", "battleTarget");
  assert.equal(s.pending[0].type, "hits");
  s = choose(s, "hit");
  assert.equal(s.pending[0].type, "dice");
  assert.equal(s.pending[0].allFresh, true);
  assert.equal(s.pieces.filter((x) => x.owner === 0 && x.damaged).length, 1);
});
test("L15 Predictive Sensors cannot move damaged ships; Rebel limit applies per origin", () => {
  let s = clear(own(fixture(), "L15", 1));
  s.players[1].leader = "LEAD05";
  place(s, 1, "ship", "1-arrow", 3);
  place(s, 1, "ship", "1-hex", 1, true);
  task(s, { type: "predictive", p: 1, system: "1-gate" });
  assert.equal(decision(s, 1).form.options.length, 3);
  assert.throws(
    () =>
      form(
        s,
        decision(s, 1).form.options.map((x) => x.id),
        1,
      ),
    /two ships/,
  );
});
test("L16 Force Beams ignores Rebel group limit and moves any ownership", () => {
  let s = clear(own(fixture(), "L16"));
  s.players[0].leader = "LEAD05";
  place(s, 0, "starport", "1-gate");
  place(s, 0, "ship", "1-gate", 2);
  place(s, 1, "ship", "1-gate", 2);
  s.turn.suit = "mobilization";
  s = choose(s, "action", (c) => c.action === "move" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "L16");
  s = choose(
    s,
    "guide",
    (c) => c.system === "1-gate" && c.target === "1-arrow",
  );
  s = form(
    s,
    decision(s, 0).form.options.map((x) => x.id),
  );
  assert.equal(s.pieces.filter((x) => x.system === "1-arrow").length, 4);
});
test("L20 Empath’s Bond permits remote tax without captives and rival starport building", () => {
  let s = clear(own(fixture(), "L20"));
  s.markers[2].ambition = "empath";
  const city = place(s, 1, "city", "1-arrow")[0];
  place(s, 1, "starport", "1-hex");
  s = act(s, "tax", "taxTarget", (c) => c.piece === city);
  assert.equal(s.players[0].captives.length, 0);
  s.turn.suit = "construction";
  s = choose(s, "action", (c) => c.action === "build" && c.cost === "pip");
  assert.ok(
    decision(s, 0).choices.some(
      (c) => c.kind === "ship" && c.system === "1-hex",
    ),
  );
});
test("L21 Keeper’s Trust blocks stealing a resource the thief already has", () => {
  let s = resources(own(diceState(), "L21", 1), 0, ["fuel"]);
  resources(s, 1, ["fuel"]);
  s.markers[2].ambition = "keeper";
  task(s, { type: "steal" });
  assert.ok(
    !decision(s, 0).choices.some(
      (c) => c.defender === 1 && c.op === "stealResource",
    ),
  );
});
test("L23 Warlord’s Cruelty allows repeated taxes while Warlord is declared", () => {
  let s = clear(own(fixture(), "L23"));
  s.markers[2].ambition = "warlord";
  const id = place(s, 0, "city", "1-arrow")[0];
  s = act(s, "tax", "taxTarget", (c) => c.piece === id);
  s = act(s, "tax", "taxTarget", (c) => c.piece === id);
  assert.equal(s.players[0].resources.filter((x) => x === "weapon").length, 2);
});
test("L24 Warlord’s Terror spends a trophy for influence", () => {
  let s = own(fixture(), "L24");
  s.markers[2].ambition = "warlord";
  s.players[0].trophies = [{ id: "test-agent", owner: 1, type: "agent" }];
  s = choose(s, "guild", (c) => c.card === "L24");
  s = choose(s, "spendTrophy");
  s = choose(s, "influenceTarget", (c) => c.index === 0);
  assert.equal(s.players[0].trophies.length, 0);
  assert.equal(s.court[0].agents[0], 1);
});
test("L25 Tyrant’s Ego spends a captive for secure", () => {
  let s = own(fixture(), "L25");
  s.markers[2].ambition = "tyrant";
  s.players[0].captives = [{ id: "test-agent", owner: 1, type: "agent" }];
  s.court[0].agents[0] = 1;
  s = choose(s, "guild", (c) => c.card === "L25");
  s = choose(s, "spendCaptive");
  s = choose(s, "secureTarget", (c) => c.index === 0);
  assert.equal(s.players[0].captives.length, 0);
});
test("L26 Tyrant’s Authority annexes rather than destroys, with no Outrage", () => {
  let s = clear(own(fixture(), "L26"));
  s.markers[2].ambition = "tyrant";
  place(s, 0, "ship", "1-arrow");
  place(s, 1, "city", "1-arrow", 1, true);
  s.turn.suit = "construction";
  s = choose(s, "action", (c) => c.action === "build" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "L26");
  s = choose(s, "annex");
  assert.ok(
    s.pieces.some((x) => x.type === "city" && x.owner === 0 && x.damaged),
  );
  assert.equal(s.players[0].outrage.length, 0);
  assert.equal(s.players[0].trophies.length, 0);
});
test("L27 Tycoon’s Ambition declares undeclared ambition without zero marker", () => {
  let s = resources(own(fixture(), "L27"), 0, ["fuel", "material"]);
  s.markers[2].ambition = "tycoon";
  s = choose(s, "guild", (c) => c.card === "L27");
  s = choose(s, "tycoonDeclare", (c) => c.ambition === "keeper");
  assert.equal(s.markers[1].ambition, "keeper");
  assert.equal(s.lead.rank, 2);
  assert.equal(s.players[0].resources.filter(Boolean).length, 0);
});
test("L28 Tycoon’s Charm trades selected material/fuel for resources", () => {
  let s = resources(own(fixture(), "L28"), 0, ["material", "fuel"]);
  s.markers[2].ambition = "tycoon";
  s = choose(s, "guild", (c) => c.card === "L28");
  s = choose(s, "tycoonTrade");
  s = form(s, ["0", "1"]);
  s = choose(s, "gain", (c) => c.resource === "relic");
  s = choose(s, "gain", (c) => c.resource === "psionic");
  assert.deepEqual(s.players[0].resources.filter(Boolean), [
    "relic",
    "psionic",
  ]);
});
for (const [id, type, max] of [
  ["BC13", "skirmish", 2],
  ["L14", "assault", 3],
  ["L19", "raid", 18],
])
  test(`${id} reroll limits and once per battle use`, () => {
    let s = own(diceState(), id);
    resources(s, 0, ["weapon", "fuel"]);
    s.markers[2].ambition = "empath";
    s.pending[0] = {
      ...s.pending[0],
      type: "reroll",
      dice: [{ type, faces: [] }],
      used: [],
      freshAttack: 3,
    };
    const before = decision(s, 0).choices.find((c) => c.op === "reroll");
    assert.equal(before.max, max);
    s.lastBattle = { dice: s.pending[0].dice };
    s = choose(s, "reroll");
    s = form(s, ["0"]);
    assert.ok(!decision(s, 0).choices.some((c) => c.op === "reroll"));
  });
test("BC12 Prison Wardens executes captives into trophies", () => {
  let s = own(fixture(), "BC12");
  s.players[0].captives = [{ id: "captured-agent", owner: 1, type: "agent" }];
  s = choose(s, "action", (c) => c.action === "influence" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "BC12");
  s = form(s, ["captured-agent"]);
  assert.equal(s.players[0].captives.length, 0);
  assert.equal(s.players[0].trophies.length, 1);
});
test("BC14 Court Enforcers requires strictly fewer rival agents than weapon icons", () => {
  let s = resources(own(fixture(), "BC14"), 0, ["weapon"]);
  s.turn.suit = "aggression";
  s.court[0].agents = [0, 1, 0, 0];
  s = choose(s, "action", (c) => c.action === "battle" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "BC14");
  s = choose(s, "abduct", (c) => c.index === 0);
  assert.equal(s.players[0].captives.length, 1);
  assert.equal(s.court[0].agents[1], 0);
});
test("BC20 Silver-Tongues can steal Guild cards and use their Prelude immediately", () => {
  let s = own(own(fixture(), "BC20"), "BC23", 1);
  s = choose(s, "guild", (c) => c.card === "BC20");
  s = choose(s, "stealCard", (c) => c.card === "BC23");
  assert.ok(
    decision(s, 0).choices.some((c) => c.op === "guild" && c.card === "BC23"),
  );
});
test("BC23 Elder Broker Trade bypasses Sworn Guardians and exchanges resources", () => {
  let s = clear(own(own(fixture(), "BC23"), "BC22", 1));
  place(s, 1, "city", "1-arrow");
  place(s, 0, "ship", "1-arrow");
  resources(s, 0, ["fuel"]);
  resources(s, 1, ["weapon"]);
  s = choose(s, "action", (c) => c.action === "tax" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "BC23");
  s = choose(s, "trade");
  assert.ok(s.players[0].resources.includes("weapon"));
  assert.ok(s.players[1].resources.includes("fuel"));
});
for (const id of ["BC26", "BC27", "BC28", "BC31"])
  test(`${id} ${CARDS[id].name}: resolve and discard, refill Court`, () => {
    let s = own(clear(fixture()), id);
    s.court[0].id = null;
    task(s, { type: "vox", id, index: 0 });
    if (id === "BC26") {
      s = choose(s, "uprising", (c) => c.cluster === 1);
      assert.equal(s.pieces.filter((x) => x.owner === 0).length, 4);
    }
    if (id === "BC27") {
      s = choose(s, "populist", (c) => c.ambition === "warlord");
      assert.equal(s.markers[2].ambition, "warlord");
    }
    if (id === "BC28") {
      s = choose(s, "outrageAll", (c) => c.resource === "material");
      assert.ok(s.players.every((p) => p.outrage.includes("material")));
    }
    if (id === "BC31") {
      const n = s.players[0].hand.length;
      s = choose(s, "call");
      assert.equal(s.players[0].hand.length, n + 1);
    }
    assert.ok(s.courtDiscard.includes(id));
    assert.ok(s.court[0].id);
  });
test("simultaneous declaration effects let current player choose order", () => {
  let s = own(fixture(), "BC17");
  s.players[0].leader = "LEAD04";
  s.turn.card = "administration-2";
  s = choose(s, "declare");
  assert.equal(s.pending[0].type, "effects");
  assert.equal(decision(s, 0).choices.length, 2);
  s = choose(s, "effect", (c) => c.index === 1);
  assert.equal(s.pending[0].type, "farseersRival");
});
test("Feastbringer pays Guild before declaration, so a given-away Farseers does not trigger", () => {
  let s = own(fixture(), "BC17");
  s.players[0].leader = "LEAD07";
  s.turn.card = "administration-2";
  s = choose(s, "declare");
  assert.ok(s.markers.every((m) => !m.ambition));
  s = choose(s, "give");
  assert.equal(s.markers[2].ambition, "tycoon");
  assert.equal(s.pending.length, 0);
  assert.ok(s.players[1].cards.includes("BC17"));
});
test("BC08 Gatekeepers adds optional dice at gates and places ships in each active gate", () => {
  let s = clear(own(fixture(), "BC08"));
  place(s, 0, "ship", "1-gate");
  place(s, 1, "ship", "1-gate");
  task(s, { type: "dice", system: "1-gate", defender: 1 });
  assert.equal(decision(s, 0).form.max, 3);
  s.pending = [];
  s = choose(s, "guild", (c) => c.card === "BC08");
  while (s.pending[0]?.type === "prelude") s = choose(s, "gatekeeper");
  for (const cluster of s.clusters)
    assert.ok(
      s.pieces.some((x) => x.owner === 0 && x.system === `${cluster}-gate`),
    );
});
test("L07 Repair Drones only repairs an attacking ship and cannot skip required repair", () => {
  let s = own(diceState(), "L07");
  const attackers = s.pending[0].attackers;
  const original = s.pieces.find((x) => x.owner === 0);
  original.damaged = true;
  place(s, 0, "ship", "1-arrow", 1, true);
  task(s, {
    type: "reroll",
    system: "1-arrow",
    defender: 1,
    attackers,
    dice: [],
    used: [],
  });
  s = choose(s, "resolve");
  assert.equal(s.pending[0].type, "repairBonus");
  const cs = decision(s, 0).choices;
  assert.deepEqual(
    cs.map((c) => c.piece),
    [original.id],
  );
  assert.ok(!cs.some((c) => c.op === "skip"));
  s = choose(s, "repairBonus");
  assert.equal(s.pieces.find((x) => x.id === original.id).damaged, false);
});
test("city destruction creates Outrage, keeps Loyal guild, and requires eligible Ransack", () => {
  let s = clear(own(own(fixture(), "BC15"), "BC13"));
  const city = place(s, 1, "city", "1-arrow", 1, true)[0];
  s.court[0].agents = [0, 1, 1, 0];
  task(s, {
    type: "hits",
    system: "1-arrow",
    target: 1,
    dealer: 0,
    left: 1,
    kind: "building",
    battle: true,
  });
  s = choose(s, "hit", (c) => c.piece === city);
  assert.ok(s.players[0].outrage.includes("weapon"));
  assert.ok(s.players[0].cards.includes("BC15"));
  assert.ok(!s.players[0].cards.includes("BC13"));
  assert.equal(s.pending[0].type, "ransack");
  assert.ok(decision(s, 0).choices.every((c) => c.op === "ransack"));
  s = choose(s, "ransack");
  assert.equal(s.players[0].trophies.length, 3);
});
test("LEAD01 Elder forbids battle Ransack and offers Beloved influence", () => {
  let s = clear(fixture());
  s.players[1].leader = "LEAD01";
  const city = place(s, 1, "city", "1-arrow", 1, true)[0];
  task(s, {
    type: "hits",
    system: "1-arrow",
    target: 1,
    dealer: 0,
    left: 1,
    kind: "building",
    battle: true,
  });
  s.pending.push({
    type: "battleEnd",
    p: 0,
    defender: 1,
    system: "1-arrow",
    beforeTrophies: 0,
  });
  s = choose(s, "hit", (c) => c.piece === city);
  assert.equal(s.pending[0].type, "freeChoice");
  assert.equal(s.pending[0].p, 1);
  s = choose(s, "influenceTarget", (c) => c.index === 0, 1);
  assert.equal(s.court[0].agents[1], 1);
});
test("LEAD06 Warrior copied battle bonus moves before a required legal battle", () => {
  let s = clear(fixture());
  s.players[0].leader = "LEAD06";
  const ships = place(s, 0, "ship", "1-arrow");
  place(s, 1, "ship", "1-gate");
  s.turn.suit = "aggression";
  s.turn.mode = "copy";
  s.turn.pips = 1;
  s = choose(s, "action", (c) => c.action === "battle" && c.cost === "pip");
  s = choose(s, "bonusBefore");
  s = choose(s, "moveFrom");
  s = form(s, ships);
  s = choose(s, "moveTo", (c) => c.system === "1-gate");
  assert.ok(decision(s, 0).choices.every((c) => c.op === "battleTarget"));
  s = choose(s, "battleTarget");
  assert.equal(s.turn.pips, 0);
  assert.equal(s.pending[0].type, "dice");
});
test("two-player mulligan exchanges six cards once with no duplication", () => {
  let s = createGame(["A", "B"], { initiative: 0 }, 8);
  const old = [...s.players[1].hand];
  s = choose(s, "mulligan", () => true, 1);
  assert.equal(s.players[1].hand.length, 6);
  assert.ok(s.players[1].hand.every((c) => !old.includes(c)));
  assert.equal(s.pending.length, 0);
  assertInvariants(s);
});
test("chapter five finishes with Power winner and initiative tie-break", () => {
  let s = fixture();
  s.chapter = 5;
  s.players.forEach((p) => (p.hand = []));
  s.players[0].power = 10;
  s.players[1].power = 10;
  s.initiative = 1;
  s = choose(s, "endTurn");
  assert.equal(s.phase, "over");
  assert.equal(s.winner, 1);
});
test("ending a scored chapter clears trophies/captives and flips lowest marker", () => {
  let s = fixture();
  s.players.forEach((p) => (p.hand = []));
  s.markers[0].ambition = "warlord";
  s.markers[1].ambition = "tyrant";
  s.players[0].trophies = [{ owner: 1, type: "agent", id: "test-trophy" }];
  s.players[0].captives = [{ owner: 1, type: "agent", id: "test-captive" }];
  s = choose(s, "endTurn");
  assert.equal(s.chapter, 2);
  assert.equal(s.players[0].power, 5);
  assert.equal(s.players[0].trophies.length, 0);
  assert.equal(s.players[0].captives.length, 0);
  assert.deepEqual([s.markers[0].high, s.markers[0].low], [4, 2]);
  assert.ok(s.markers.every((m) => !m.ambition));
});
test("free bonus actions cannot be replaced with new actions that require paid pips/resources", () => {
  const s = own(fixture(), "BC12");
  s.players[0].captives = [{ id: "captive", owner: 1, type: "agent" }];
  task(s, {
    type: "action",
    action: "influence",
    cost: "free",
    configured: true,
  });
  assert.ok(!decision(s, 0).choices.some((c) => c.op === "special"));
});
test("Living Structures cannot prune a Cloud City or gate building under publisher errata", () => {
  const s = clear(own(fixture(), "L10"));
  const city = place(s, 0, "city", "1-arrow")[0];
  s.pieces.find((x) => x.id === city).cloud = true;
  place(s, 0, "starport", "1-gate");
  task(s, { type: "special", card: "L10", action: "repair", cost: "pip" });
  assert.ok(!decision(s, 0).choices.some((c) => c.op === "prune"));
});
test("Outrage placeholders reserve future agents without a negative displayed supply", () => {
  const s = fixture();
  s.players[0].outrage = ["material", "fuel"];
  s.court[0].agents[0] = 10;
  assert.equal(pool(s, 0, "agent"), 0);
  s.court[0].agents[0] = 7;
  assert.equal(pool(s, 0, "agent"), 1);
});
test("consecutive voluntary initiative passes end the chapter", () => {
  let s = fixture();
  s.phase = "card";
  s.turn = null;
  s.lead = null;
  for (let i = 0; i < 4; i++) s = choose(s, "pass");
  assert.equal(s.chapter, 2);
  assert.ok(s.players.every((p) => p.hand.length === 6));
});
test("seize uses an extra hidden card and cannot be repeated this round", () => {
  let s = fixture();
  s.initiative = 1;
  s.turn.mode = "copy";
  const n = s.players[0].hand.length;
  s = choose(s, "seize");
  assert.equal(s.players[0].hand.length, n - 1);
  assert.equal(s.initiative, 0);
  assert.equal(s.seized, true);
  assert.equal(viewFor(s, 1).played.at(-1).card, null);
  assert.ok(!decision(s, 0).choices.some((c) => c.op === "seize"));
});
test("weapons unlock battles for pips, never for fuel or psionic actions of another suit", () => {
  let s = resources(fixture(), 0, ["weapon", "psionic"]);
  s = choose(s, "weapons", (c) => c.cost === 0);
  const system = s.pieces.find(
    (x) => x.owner === 0 && x.type === "ship",
  ).system;
  place(s, 1, "ship", system);
  const cs = decision(s, 0).choices;
  assert.ok(cs.some((c) => c.action === "battle" && c.cost === "pip"));
  assert.ok(
    !cs.some((c) => c.action === "battle" && typeof c.cost === "number"),
  );
  s = choose(s, "endPrelude");
  assert.equal(s.held.length, 0);
});
test("fleet elimination revives three fresh ships at a chosen active gate", () => {
  let s = clear(fixture());
  s = choose(s, "endTurn");
  assert.equal(s.pending[0].type, "revive");
  s = choose(s, "revive", (c) => c.system === "1-gate");
  assert.equal(
    s.pieces.filter((x) => x.owner === 0 && x.system === "1-gate").length,
    3,
  );
  assert.equal(s.current, 1);
});
for (const [id, r] of [
  ["BC02", "material"],
  ["BC09", "fuel"],
])
  test(`${id} discarded Interest fills empty slots then steals after supply empties`, () => {
    let s = own(fixture(), id);
    for (const p of s.players) resources(s, p.id, []);
    resources(s, 1, [r, r, r]);
    resources(s, 2, [r]);
    s = choose(s, "guild", (c) => c.card === id);
    s = choose(s, "interestGain");
    s = choose(s, "stealResource", (c) => c.defender === 1);
    s = choose(s, "stealResource", (c) => c.defender === 1);
    assert.equal(s.players[0].resources.filter((x) => x === r).length, 3);
    assert.equal(s.supply[r], 0);
    assert.ok(s.courtDiscard.includes(id));
  });
for (const [id, r] of [
  ["BC03", "material"],
  ["BC06", "fuel"],
])
  test(`${id} discarded Cartel steals one resource`, () => {
    let s = own(fixture(), id);
    resources(s, 0, []);
    resources(s, 1, [r]);
    s = choose(s, "guild", (c) => c.card === id);
    s = choose(s, "stealResource", (c) => c.defender === 1);
    assert.ok(s.players[0].resources.includes(r));
    assert.ok(s.courtDiscard.includes(id));
  });
for (const id of ["BC12", "BC13", "BC14", "BC15"])
  test(`${id} discard deploys three ships in a controlled system`, () => {
    let s = own(fixture(), id);
    const n = pool(s, 0, "ship");
    s = choose(s, "guild", (c) => c.card === id);
    s = choose(s, "placeFleet");
    assert.equal(pool(s, 0, "ship"), n - 3);
    assert.ok(s.courtDiscard.includes(id));
  });
test("BC17 Farseers declared inspection is private and swaps exactly one card", () => {
  let s = own(fixture(), "BC17");
  s.turn.card = "administration-2";
  s = choose(s, "declare");
  s = choose(s, "inspectHand", (c) => c.rival === 1);
  assert.equal(viewFor(s, 2).decision.choices.length, 0);
  const take = decision(s, 0).choices.find((c) => c.op === "swapTake").card;
  const give = s.players[0].hand[0];
  s = choose(s, "swapTake", (c) => c.card === take);
  s = choose(s, "swapGive", (c) => c.card === give);
  assert.ok(s.players[0].hand.includes(take));
  assert.ok(s.players[1].hand.includes(give));
  assert.equal(s.players[0].hand.length, 6);
  assert.equal(s.players[1].hand.length, 6);
});
test("BC17 Farseers can discard itself alone to draw one action card", () => {
  let s = own(fixture(), "BC17");
  const n = s.players[0].hand.length;
  s = choose(s, "guild", (c) => c.card === "BC17");
  s = form(s, []);
  assert.equal(s.players[0].hand.length, n + 1);
  assert.ok(s.courtDiscard.includes("BC17"));
});
test("BC23 Elder Broker discard gains all three different resources", () => {
  let s = resources(own(fixture(), "BC23"), 0, []);
  s = choose(s, "guild", (c) => c.card === "BC23");
  assert.deepEqual(s.players[0].resources.filter(Boolean), [
    "material",
    "fuel",
    "weapon",
  ]);
});
test("resource rearrangement swaps occupied and empty slots without creating tokens", () => {
  let s = resources(fixture(), 0, ["relic", "fuel"]);
  task(s, { type: "arrangeResources" });
  s = choose(s, "arrangePick", (c) => c.index === 0);
  s = choose(s, "swapSlot", (c) => c.index === 1);
  assert.deepEqual(s.players[0].resources.slice(0, 2), ["fuel", "relic"]);
  assertInvariants(s);
});
test("gate city tax chooses from all planet-city types in the cluster", () => {
  let s = clear(fixture());
  place(s, 1, "city", "1-arrow");
  place(s, 2, "city", "1-hex");
  const gate = place(s, 0, "city", "1-gate")[0];
  s = act(s, "tax", "taxTarget", (c) => c.piece === gate);
  assert.deepEqual(
    decision(s, 0).choices.map((c) => c.resource),
    ["weapon", "material"],
  );
  s = choose(s, "taxResource", (c) => c.resource === "material");
  assert.ok(s.players[0].resources.includes("material"));
});
test("Living Structures Nurture taxes and applies Mystic’s copied tax modifier", () => {
  let s = resources(own(fixture(), "L10"), 0, []);
  s.players[0].leader = "LEAD02";
  s.turn.mode = "copy";
  s.turn.suit = "construction";
  s = choose(s, "action", (c) => c.action === "build" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "L10");
  s = choose(s, "nurture");
  assert.ok(s.players[0].resources.includes("psionic"));
});
test("Prison Wardens Pressgang returns captives and grants one resource each", () => {
  let s = resources(own(fixture(), "BC12"), 0, []);
  s.players[0].captives = [
    { id: "a", type: "agent", owner: 1 },
    { id: "b", type: "agent", owner: 2 },
  ];
  s.turn.suit = "construction";
  s = choose(s, "action", (c) => c.action === "build" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "BC12");
  s = form(s, ["a", "b"]);
  assert.equal(s.players[0].captives.length, 0);
  s = choose(s, "gain", (c) => c.resource === "relic");
  s = choose(s, "gain", (c) => c.resource === "psionic");
  assert.equal(s.players[0].resources.filter(Boolean).length, 2);
});
test("Empath’s Vision also rerolls Galactic Rifles outside battle", () => {
  let s = clear(own(own(fixture(), "L02"), "L19"));
  s.markers[2].ambition = "empath";
  place(s, 0, "ship", "1-arrow");
  place(s, 1, "ship", "1-gate");
  s.turn.suit = "aggression";
  s = choose(s, "action", (c) => c.action === "battle" && c.cost === "pip");
  s = choose(s, "special", (c) => c.card === "L02");
  s = choose(s, "rifles");
  s = choose(s, "rifleDice", (c) => c.n === 1);
  assert.equal(s.pending[0].stage, "reroll");
  s = form(s, ["0"]);
  assert.notEqual(s.pending[0]?.stage, "reroll");
});
test("highest Surpass wins initiative when nobody seized it", () => {
  let s = fixture();
  s.current = 3;
  s.roundLeader = 0;
  s.played = [
    { player: 0, card: "administration-2", mode: "lead", faceup: true },
    { player: 1, card: "administration-3", mode: "surpass", faceup: true },
    { player: 2, card: "administration-6", mode: "surpass", faceup: true },
  ];
  for (const p of s.players)
    p.hand = p.hand.filter((id) => !s.played.some((c) => c.card === id));
  s.discard = s.discard.filter((id) => !s.played.some((c) => c.card === id));
  s = choose(s, "endTurn");
  assert.equal(s.initiative, 2);
  assert.equal(s.current, 2);
});
test("Union retrieval happens at round end and returns its card to the discard", () => {
  let s = fixture();
  s.current = 3;
  s.roundLeader = 0;
  const target = "administration-3";
  s.played = [{ player: 0, card: target, mode: "lead", faceup: true }];
  for (const p of s.players) p.hand = p.hand.filter((id) => id !== target);
  s.discard = s.discard.filter((id) => id !== target);
  s.unions = [{ p: 1, card: "BC04", target }];
  s = choose(s, "endTurn");
  assert.ok(s.players[1].hand.includes(target));
  assert.ok(s.courtDiscard.includes("BC04"));
  assert.equal(s.unions.length, 0);
});
test("Corsair counts resource types held on Cartels for its raid reroll limit", () => {
  let s = resources(own(diceState(), "BC03"), 0, ["fuel"]);
  s.players[0].leader = "LEAD11";
  s.pending[0] = {
    ...s.pending[0],
    type: "reroll",
    dice: [{ type: "raid", faces: [] }],
    used: [],
    freshAttack: 3,
  };
  assert.equal(
    decision(s, 0).choices.find((c) => c.ability === "Corsair").max,
    2,
  );
});
test("Elder Broker cannot give a resource type that a rival holds through a Cartel", () => {
  let s = clear(own(own(fixture(), "BC23"), "BC06", 1));
  place(s, 1, "city", "1-arrow");
  place(s, 0, "ship", "1-arrow");
  resources(s, 0, ["fuel"]);
  resources(s, 1, ["weapon"]);
  task(s, { type: "special", card: "BC23", action: "tax", cost: "pip" });
  assert.ok(!decision(s, 0).choices.some((c) => c.op === "trade"));
});
test("Overseer may use Ruthless to hit a starport when no ships remain in supply", () => {
  let s = clear(fixture());
  s.players[0].leader = "LEAD10";
  place(s, 0, "ship", "1-arrow", 15);
  const port = place(s, 0, "starport", "1-arrow")[0];
  s.turn.suit = "construction";
  s = choose(s, "action", (c) => c.action === "build" && c.cost === "pip");
  s = choose(s, "ruthlessEmptyBuild");
  assert.equal(s.pieces.find((x) => x.id === port).damaged, true);
  assert.ok(s.turn.used.includes("ruthless"));
  assert.equal(s.turn.pips, 3);
  assert.equal(pool(s, 0, "ship"), 0);
});
test("public draft candidates are visible to every player while the unused lore deck stays private", () => {
  const s = createGame(["A", "B", "C"], { leaders: true, initiative: 0 }, 5);
  const observer = viewFor(s, 0);
  assert.deepEqual(observer.draft.leaders, s.draft.leaders);
  assert.deepEqual(observer.draft.lore, s.draft.lore);
  assert.equal(observer.draft.remaining, undefined);
  assert.equal(observer.decision.choices.length, 0);
});

test("public declaration context retains printed rank, declarer and marker after turn ends", () => {
  let s = fixture();
  s.turn.card = "mobilization-2";
  s.turn.suit = "mobilization";
  s.lead = { ...ACTION_CARDS["mobilization-2"], player: 0 };
  s = choose(s, "declare", (c) => c.ambition === "tycoon");
  s = choose(s, "endTurn");
  const v = viewFor(s, 1);
  assert.equal(v.lead.rank, 0);
  assert.deepEqual(v.lead.declarations, [
    { player: 0, ambition: "tycoon", high: 5, low: 3, zero: true },
  ]);
  assert.equal(ACTION_CARDS[v.lead.id].rank, 2);
});

test("declaration context distinguishes a declaration that preserves rank", () => {
  let s = fixture();
  own(s, "BC18");
  s.turn.card = "administration-5";
  s.lead = { ...ACTION_CARDS["administration-5"], player: 0 };
  s = choose(s, "declare");
  assert.equal(s.lead.rank, 5);
  assert.equal(viewFor(s, 2).lead.declarations[0].zero, false);
});
