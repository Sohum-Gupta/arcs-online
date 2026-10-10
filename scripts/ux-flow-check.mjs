import { gunzipSync } from "node:zlib";
import { chromium, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { viewFor, decision } from "../game/engine.js";
import { applyDecision, historyView } from "../server/history.js";
const fixtures = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../tests/fixtures/ux-states.json.gz", import.meta.url),
      ),
    ).toString("utf8"),
  ),
  base = process.env.TEST_URL ?? "http://localhost:5173",
  id = "ABCDDE13";
let room,
  p,
  writes = 0;
const projection = () => ({
  id,
  me: p,
  host: true,
  status: "playing",
  game: viewFor(room.game, p),
  seats: room.game.players.map((p) => ({ name: p.name })),
  options: { timer: { mode: "off" } },
  history: historyView(room, p),
});
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1512, height: 982 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript((id) => {
  localStorage.setItem(`arcs-seat-${id}`, "fixture");
  window.WebSocket = class {
    constructor() {
      setTimeout(() => this.onopen?.(), 10);
    }
    send() {
      fetch(`/api/rooms/${id}`)
        .then((r) => r.json())
        .then((data) => this.onmessage?.({ data: JSON.stringify(data) }));
    }
    close() {}
  };
}, id);
await page.route(`**/api/rooms/${id}**`, async (route) => {
  if (route.request().method() === "POST") {
    applyDecision(room, p, route.request().postDataJSON());
    writes++;
  }
  await route.fulfill({ json: projection() });
});
const load = async (kind, alter = () => {}) => {
  room = { game: structuredClone(fixtures[kind].raw) };
  alter(room.game);
  p = room.game.pending[0]?.p ?? room.game.current;
  await page.goto(`${base}/table/${id}`);
  await page.locator(".command-live").waitFor();
};
try {
  await load("overflow");
  const discard = decision(room.game, p).choices[0],
    before = room.game.players[p].resources.filter(Boolean).length;
  await page.getByRole("button", { name: discard.label, exact: true }).click();
  assert.equal(
    room.game.players[p].resources.filter(Boolean).length,
    before - 1,
  );
  await load("gainChoice");
  const gain = decision(room.game, p).choices.find((c) => c.op === "gain");
  const n = room.game.supply[gain.resource];
  await page.getByRole("button", { name: gain.label, exact: true }).click();
  assert.equal(room.game.supply[gain.resource], n - 1);
  await load("effects");
  const effect = decision(room.game, p).choices[0];
  await page.getByRole("button", { name: effect.label, exact: true }).click();
  assert.ok(room.game.revision > fixtures.effects.raw.revision);
  await load("dice");
  assert.ok(
    Number(
      await page
        .getByRole("spinbutton", { name: "skirmish dice" })
        .inputValue(),
    ) > 0,
  );
  for (const viewport of [
    { width: 1512, height: 982 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => {
        const r = await page
          .getByRole("button", { name: "Roll battle dice", exact: true })
          .boundingBox();
        return r && r.y >= 0 && r.y + r.height <= viewport.height;
      })
      .toBe(true);
  }
  await page.setViewportSize({ width: 1512, height: 982 });
  const prior = writes;
  await page
    .getByRole("button", { name: "Assault · more risk", exact: true })
    .click();
  assert.equal(writes, prior);
  const f = decision(room.game, p).form,
    d = {};
  for (const type of ["skirmish", "assault", "raid"])
    d[type] = Number(
      await page.getByRole("spinbutton", { name: `${type} dice` }).inputValue(),
    );
  assert.ok(Object.values(d).reduce((a, b) => a + b, 0) <= f.max);
  if (f.corsair) assert.ok(d.assault <= d.skirmish);
  await page.getByRole("button", { name: "Guidance on", exact: true }).click();
  assert.equal(await page.locator(".decision-instruction").count(), 0);
  await page.reload();
  await page
    .getByRole("button", { name: "Guidance off", exact: true })
    .waitFor();
  assert.equal(writes, prior);
  await page.getByRole("button", { name: "Guidance off", exact: true }).click();
  await load("actionsRoot", (s) => {
    s.pending = [];
    s.turn.pips = 0;
    s.turn.acted = true;
    s.turn.prelude = false;
  });
  assert.deepEqual(
    decision(room.game, p).choices.map((c) => c.op),
    ["endTurn"],
  );
  await page
    .getByRole("button", { name: "Confirm & end turn", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "End turn", exact: true }).count(),
    0,
  );
  const handoff = writes;
  await page
    .getByRole("button", { name: "Confirm & end turn", exact: true })
    .click();
  assert.equal(writes, handoff + 1);
  await load("repairBonus");
  const repair = decision(room.game, p).choices.find((c) => c.piece);
  assert.ok(repair);
  await page.locator(`[data-piece="${repair.piece}"]`).click();
  assert.equal(
    room.game.pieces.find((x) => x.id === repair.piece).damaged,
    false,
  );
  await load("preludeRoot", (s) => {
    s.pending = [{ type: "farseersDiscard", p: s.current }];
  });
  const cards = decision(room.game, p).form.options;
  assert.equal(
    await page.locator(".selection-gallery .decision-card-art").count(),
    cards.length,
  );
  await page
    .getByRole("checkbox", { name: cards[0].label, exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: cards[0].label, exact: true })
      .getAttribute("aria-checked"),
    "true",
  );
  await page
    .getByRole("button", { name: "Confirm selection", exact: true })
    .click();
  assert.ok(!room.game.players[p].hand.includes(cards[0].id));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      visualResourceActions: true,
      effectOrdering: true,
      legalDiceDefaults: true,
      noPresetCommits: true,
      teachingPreference: true,
      exhaustedTurnOneClick: true,
      mapBonusRepair: true,
      visualHandSelection: true,
      errors,
    }),
  );
} catch (e) {
  await page.screenshot({
    path: "work/ux-flow-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
