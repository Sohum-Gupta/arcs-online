import assert from "node:assert/strict";
const base = process.env.TEST_URL ?? "http://localhost:4317";
async function request(path, key, body) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
const host = (
  await request("/api/rooms", null, {
    name: "Movement verification",
    players: 2,
  })
).data;
const root = `/api/rooms/${host.id}`;
const guest = (
  await request(root + "/join", null, {
    name: "Verification rival",
    invite: host.invite,
  })
).data;
const keys = [host.key, guest.key];
assert.equal((await request(root + "/start", host.key, {})).status, 200);
let key = host.key,
  view = (await request(root, key)).data;
for (let i = 0; i < 30; i++) {
  key = keys[view.game.decision.actor];
  view = (await request(root, key)).data;
  const d = view.game.decision;
  if (d.form?.kind === "pieces" && view.game.interaction?.kind === "moveSelect")
    break;
  const c =
    d.choices.find((c) => c.op === "skip") ??
    d.choices.find(
      (c) => c.op === "play" && /^(mobilization|aggression)-/.test(c.card),
    ) ??
    d.choices.find((c) => c.op === "endPrelude") ??
    d.choices.find(
      (c) => c.op === "action" && c.action === "move" && c.cost === "pip",
    ) ??
    d.choices.find((c) => c.op === "moveFrom") ??
    d.choices.find((c) => c.op === "endTurn") ??
    d.choices.find((c) => c.op === "play");
  assert.ok(c, d.title);
  const response = await request(root + "/action", key, {
    revision: view.game.revision,
    choice: c.id,
  });
  assert.equal(response.status, 200);
  view = response.data;
}
assert.equal(view.game.interaction.kind, "moveSelect");
const before = structuredClone(view.game),
  value = before.decision.form.options.map((o) => o.id),
  destination = before.interaction.destinations[0];
const invalid = await request(root + "/action", key, {
  revision: before.revision,
  value,
  destination: "invalid",
});
assert.equal(invalid.status, 400);
assert.equal((await request(root, key)).data.game.revision, before.revision);
const input = { revision: before.revision, value, destination };
const moved = await request(root + "/action", key, input);
assert.equal(moved.status, 200);
assert.equal(moved.data.game.turn.pips, before.turn.pips - 1);
for (const id of value)
  assert.equal(
    moved.data.game.pieces.find((p) => p.id === id).system,
    destination,
  );
assert.equal((await request(root + "/action", key, input)).status, 409);
const undone = await request(root + "/history", key, {
  revision: moved.data.game.revision,
  direction: "undo",
});
assert.equal(undone.status, 200);
assert.deepEqual(undone.data.game.pieces, before.pieces);
assert.equal(undone.data.game.turn.pips, before.turn.pips);
const redone = await request(root + "/history", key, {
  revision: undone.data.game.revision,
  direction: "redo",
});
assert.equal(redone.status, 200);
assert.deepEqual(redone.data.game.pieces, moved.data.game.pieces);
assert.deepEqual(
  (await request(root, key)).data.game.pieces,
  moved.data.game.pieces,
);
console.log(
  JSON.stringify({
    atomicMovement: true,
    invalidDestinationNoMutation: true,
    staleRetryRejected: true,
    oneStepUndoRedo: true,
    persisted: true,
  }),
);
