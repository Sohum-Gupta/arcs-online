import test from "node:test";
import assert from "node:assert/strict";
import { playPreview, ACTION_HELP } from "../src/learning.js";
import { ACTION_CARDS, SUITS } from "../game/data.js";
test("play guidance follows effective suit and pip budget for every card and mode", () => {
  for (const card of Object.values(ACTION_CARDS))
    for (const lead of Object.values(ACTION_CARDS)) {
      const game = { lead };
      const copy = playPreview({ card: card.id, mode: "copy" }, game);
      assert.equal(copy.suit, lead.suit);
      assert.equal(copy.pips, 1);
      assert.deepEqual(copy.actions, SUITS[lead.suit]);
      for (const mode of ["lead", "surpass", "pivot"]) {
        const p = playPreview({ card: card.id, mode }, game);
        assert.equal(p.suit, card.suit);
        assert.equal(p.pips, mode === "pivot" ? 1 : card.pips);
      }
    }
});
test("every standard action has novice guidance and examples", () => {
  for (const action of new Set(Object.values(SUITS).flat())) {
    const h = ACTION_HELP[action];
    assert.ok(h?.summary && h.detail && h.example);
  }
  const p = playPreview(
    { card: "construction-2", mode: "surpass" },
    { lead: { ...ACTION_CARDS["construction-5"], rank: 0 } },
  );
  assert.match(p.summary, /2 beats 0/);
});
