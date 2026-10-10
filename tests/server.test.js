import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { WebSocket } from "ws";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
test("real HTTP/WebSocket server: authorization, invite-only seats, atomic revisions, privacy, persistence", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "arcs-test-"));
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const base = `http://127.0.0.1:${port}`;
  let child,
    logs = "";
  const start = async () => {
    child = spawn(process.execPath, ["server/index.js"], {
      env: { ...process.env, PORT: String(port), DATA_DIR: dir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => (logs += d));
    child.stderr.on("data", (d) => (logs += d));
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      await delay(30);
    }
    throw new Error(logs);
  };
  const stop = async () => {
    if (child.exitCode === null) {
      const exited = new Promise((r) => child.once("exit", r));
      child.kill("SIGTERM");
      await exited;
    }
  };
  t.after(async () => {
    await stop();
    await rm(dir, { recursive: true, force: true });
  });
  await start();
  const req = async (url, method = "GET", body, key, headers = {}) => {
    const response = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  const created = await req("/api/rooms", "POST", { name: "Host", players: 2 });
  assert.equal(created.status, 201);
  const { id, key, invite } = created.data;
  const root = `/api/rooms/${id}`;
  await t.test("no private state without a seat credential", async () => {
    assert.equal((await req(root)).status, 403);
    assert.equal((await req(root, "GET", null, "wrong")).status, 403);
    assert.equal(
      (await req(root + "/join", "POST", { name: "Thief", invite: "wrong" }))
        .status,
      403,
    );
  });
  const guest = await req(root + "/join", "POST", { name: "Friend", invite });
  assert.equal(guest.status, 200);
  const guestKey = guest.data.key;
  await t.test(
    "only host can start and seats cannot be overfilled",
    async () => {
      assert.equal(
        (await req(root + "/start", "POST", {}, guestKey)).status,
        403,
      );
      assert.equal(
        (await req(root + "/join", "POST", { name: "Extra", invite })).status,
        409,
      );
    },
  );
  let state = await req(root + "/start", "POST", {}, key);
  assert.equal(state.status, 200);
  assert.equal(state.data.game.players[0].hand.length, 6);
  assert.equal(typeof state.data.game.players[1].hand, "number");
  assert.equal(state.data.game.rng, undefined);
  await t.test(
    "cross-origin mutations and malformed origin rejected",
    async () => {
      assert.equal(
        (
          await req(root + "/action", "POST", {}, key, {
            Origin: "https://unrelated.example",
          })
        ).status,
        403,
      );
      assert.equal(
        (await req(root + "/action", "POST", {}, key, { Origin: "::bad" }))
          .status,
        403,
      );
    },
  );
  await t.test(
    "resource tray endpoint validates tokens and revision, commits once, and supports Undo",
    async () => {
      // Reach a real gain window by playing through ordinary legal turns.
      for (let n = 0; n < 80; n++) {
        const owner = state.data.game.decision.actor,
          credential = owner === 0 ? key : guestKey;
        const v = (await req(root, "GET", null, credential)).data.game;
        if (v.resourceArrangement) break;
        const cs = v.decision.choices;
        const c =
          cs.find((c) => c.op === "skip") ??
          cs.find(
            (c) => c.op === "play" && c.card.startsWith("administration"),
          ) ??
          cs.find((c) => c.op === "play") ??
          cs.find((c) => c.op === "endPrelude") ??
          cs.find(
            (c) => c.op === "action" && c.action === "tax" && c.cost === "pip",
          ) ??
          cs.find((c) => c.op === "taxTarget") ??
          cs.find((c) => c.op === "endTurn") ??
          cs[0];
        assert.ok(c);
        const result = await req(
          root + "/action",
          "POST",
          { revision: v.revision, choice: c.id },
          credential,
        );
        assert.equal(result.status, 200);
        state = result;
      }
      const owner = state.data.game.decision.actor,
        credential = owner === 0 ? key : guestKey;
      const view = (await req(root, "GET", null, credential)).data;
      assert.ok(view.game.resourceArrangement);
      const order = [...view.game.players[owner].resources].reverse(),
        revision = view.game.revision;
      const invalid = await req(
        root + "/action",
        "POST",
        { revision, resourceArrangement: [] },
        credential,
      );
      assert.equal(invalid.status, 400);
      assert.equal(
        (await req(root, "GET", null, credential)).data.game.revision,
        revision,
      );
      const result = await req(
        root + "/action",
        "POST",
        { revision, resourceArrangement: order },
        credential,
      );
      assert.equal(result.status, 200);
      assert.deepEqual(result.data.game.players[owner].resources, order);
      const stale = await req(
        root + "/action",
        "POST",
        { revision, resourceArrangement: order },
        credential,
      );
      assert.equal(stale.status, 409);
      const undo = await req(
        root + "/history",
        "POST",
        { revision: result.data.game.revision, direction: "undo" },
        credential,
      );
      assert.equal(undo.status, 200);
      assert.deepEqual(
        undo.data.game.players[owner].resources,
        view.game.players[owner].resources,
      );
      assert.ok(undo.data.game.resourceArrangement);
      state = await req(root, "GET", null, key);
    },
  );
  const initialRevision = state.data.game.revision;
  const actor = state.data.game.decision.actor;
  const actorKey = actor === 0 ? key : guestKey;
  const actorView = (await req(root, "GET", null, actorKey)).data;
  const choice =
    actorView.game.decision.choices.find((c) => c.op === "skip") ??
    actorView.game.decision.choices[0];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`);
  const messages = [];
  ws.on("message", (d) => messages.push(JSON.parse(d)));
  await new Promise((r) => ws.once("open", r));
  ws.send(JSON.stringify({ id, key: guestKey }));
  for (let i = 0; i < 50 && !messages.length; i++) await delay(20);
  assert.ok(messages.length);
  assert.equal(typeof messages[0].game.players[0].hand, "number");
  await t.test(
    "one accepted command broadcasts and stale retry cannot apply twice",
    async () => {
      const body = { revision: initialRevision, choice: choice.id };
      const success = await req(root + "/action", "POST", body, actorKey);
      assert.equal(success.status, 200);
      state = success;
      assert.equal(
        (await req(root + "/action", "POST", body, actorKey)).status,
        409,
      );
      for (
        let i = 0;
        i < 50 &&
        !messages.some((m) => m.game.revision === initialRevision + 1);
        i++
      )
        await delay(20);
      assert.ok(messages.some((m) => m.game.revision === initialRevision + 1));
    },
  );
  await t.test(
    "forged choices are rejected without changing saved state",
    async () => {
      const a = state.data.game.decision.actor;
      const correct = a === 0 ? key : guestKey;
      const before = (await req(root, "GET", null, correct)).data.game;
      assert.equal(
        (
          await req(
            root + "/action",
            "POST",
            { revision: before.revision, choice: 9999 },
            correct,
          )
        ).status,
        400,
      );
      assert.equal(
        (await req(root, "GET", null, correct)).data.game.revision,
        before.revision,
      );
    },
  );
  await t.test(
    "undo/redo routes enforce ownership, monotonic revisions, privacy and persisted clocks",
    async () => {
      let turnKey = key;
      let v = (await req(root, "GET", null, turnKey)).data;
      for (let n = 0; n < 8; n++) {
        turnKey = v.game.decision.actor === 0 ? key : guestKey;
        v = (await req(root, "GET", null, turnKey)).data;
        if (v.history.canUndo) break;
        const c =
          v.game.decision.choices.find((c) => c.op === "skip") ??
          v.game.decision.choices.find((c) => c.op === "play");
        assert.ok(c);
        v = (
          await req(
            root + "/action",
            "POST",
            { revision: v.game.revision, choice: c.id },
            turnKey,
          )
        ).data;
      }

      assert.equal(v.history.canUndo, true);
      const rivalKey = turnKey === key ? guestKey : key;
      assert.equal(
        (
          await req(
            root + "/history",
            "POST",
            { revision: v.game.revision, direction: "undo" },
            rivalKey,
          )
        ).status,
        400,
      );
      const beforeGame = v.game;
      v = (
        await req(
          root + "/history",
          "POST",
          { revision: v.game.revision, direction: "undo" },
          turnKey,
        )
      ).data;
      assert.equal(v.game.revision, beforeGame.revision + 1);
      assert.equal(v.history.canRedo, true);
      const stale = await req(
        root + "/history",
        "POST",
        { revision: beforeGame.revision, direction: "redo" },
        turnKey,
      );
      assert.equal(stale.status, 409);
      v = (
        await req(
          root + "/history",
          "POST",
          { revision: v.game.revision, direction: "redo" },
          turnKey,
        )
      ).data;
      assert.deepEqual(v.game.pieces, beforeGame.pieces);
      assert.deepEqual(v.game.turn, beforeGame.turn);
      assert.ok(!JSON.stringify(v.history).includes("courtDeck"));
      assert.equal(
        (
          await req(
            root + "/timer",
            "POST",
            { revision: v.game.revision, operation: "pause" },
            guestKey,
          )
        ).status,
        403,
      );
      v = (
        await req(
          root + "/timer",
          "POST",
          {
            revision: v.game.revision,
            operation: "configure",
            config: { mode: "live", seconds: 300, expiry: "pause" },
          },
          key,
        )
      ).data;
      assert.equal(v.clock.config.seconds, 300);
      v = (
        await req(
          root + "/timer",
          "POST",
          { revision: v.game.revision, operation: "pause" },
          key,
        )
      ).data;
      assert.equal(v.clock.blocked, true);
      assert.equal(
        (
          await req(
            root + "/history",
            "POST",
            { revision: v.game.revision, direction: "undo" },
            turnKey,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await req(
            root + "/action",
            "POST",
            { revision: v.game.revision, choice: 0 },
            turnKey,
          )
        ).status,
        400,
      );
      state = { data: v };
    },
  );
  ws.close();
  await new Promise((r) => ws.once("close", r));
  const before = (await req(root, "GET", null, key)).data;
  await stop();
  await start();
  await t.test(
    "server restart preserves board, private hand, revision and invite membership",
    async () => {
      const after = (await req(root, "GET", null, key)).data;
      assert.deepEqual(after.game, before.game);
      assert.deepEqual(after.history, before.history);
      assert.deepEqual(after.clock.spent, before.clock.spent);
      assert.equal(after.clock.paused, true);
      assert.equal(after.seats.length, 2);
      assert.equal(
        (await req(root + "/export", "GET", null, guestKey)).data.game.me,
        1,
      );
    },
  );
});
