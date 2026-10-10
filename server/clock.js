import { RuleError } from "../game/engine.js";
const actorOf = (s) =>
  !s || s.phase === "over" ? null : (s.pending[0]?.p ?? s.current);
const turnKey = (s) =>
  !s
    ? "lobby"
    : s.phase === "draft"
      ? `draft:${s.current}`
      : `${s.chapter}:${s.round}:${s.current}`;
export function validateTimer(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RuleError("Choose timer settings.");
  const mode = value.mode ?? "off",
    expiry = value.expiry ?? "auto";
  if (
    !["off", "live", "async"].includes(mode) ||
    !["overtime", "pause", "auto"].includes(expiry)
  )
    throw new RuleError("Choose a valid timer mode and timeout behavior.");
  const seconds =
    mode === "off" ? 0 : (value.seconds ?? (mode === "live" ? 300 : 86400));
  if (
    !Number.isInteger(seconds) ||
    (mode === "live" && (seconds < 60 || seconds > 3600)) ||
    (mode === "async" && (seconds < 3600 || seconds > 604800))
  )
    throw new RuleError(
      "Live timers support 1–60 minutes; async timers support 1–168 hours.",
    );
  return { mode, seconds, expiry };
}
export function initClock(room, now = Date.now()) {
  if (room.clock) {
    for (const field of ["spent", "total", "bonus"])
      room.clock[field] = room.seats.map((_, i) => room.clock[field][i] ?? 0);
    return;
  }
  room.clock = {
    config: validateTimer(room.options?.timer),
    key: turnKey(room.game),
    actor: actorOf(room.game),
    since: now,
    spent: room.seats.map(() => 0),
    total: room.seats.map(() => 0),
    bonus: room.seats.map(() => 0),
    paused: false,
  };
}
export function clockView(room, now = Date.now()) {
  if (!room.clock) {
    const copy = { ...room };
    initClock(copy, now);
    return clockView(copy, now);
  }
  const c = room.clock,
    spent = [...c.spent],
    total = [...c.total],
    active = c.actor;
  let dt = active === null || c.paused ? 0 : Math.max(0, now - c.since);
  if (
    active !== null &&
    c.config.mode !== "off" &&
    ["pause", "auto"].includes(c.config.expiry)
  )
    dt = Math.min(
      dt,
      Math.max(
        0,
        c.config.seconds * 1000 + (c.bonus[active] ?? 0) - (spent[active] ?? 0),
      ),
    );
  if (active !== null) {
    spent[active] = (spent[active] ?? 0) + dt;
    total[active] = (total[active] ?? 0) + dt;
  }
  const remaining =
    active === null || c.config.mode === "off"
      ? null
      : c.config.seconds * 1000 + (c.bonus[active] ?? 0) - (spent[active] ?? 0);
  return {
    config: c.config,
    actor: active,
    serverNow: now,
    spent,
    total,
    bonus: c.bonus,
    remainingMs: remaining,
    paused: c.paused,
    blocked:
      c.paused ||
      (remaining !== null &&
        remaining <= 0 &&
        ["pause", "auto"].includes(c.config.expiry)),
    complete: room.game?.phase === "over",
    key: c.key,
  };
}
export function settleClock(room, now = Date.now()) {
  initClock(room, now);
  const v = clockView(room, now),
    c = room.clock;
  c.spent = v.spent;
  c.total = v.total;
  c.since = now;
}
export function followClock(room, now = Date.now()) {
  initClock(room, now);
  const c = room.clock,
    key = turnKey(room.game);
  if (key !== c.key) {
    c.key = key;
    c.spent = room.seats.map(() => 0);
    c.bonus = room.seats.map(() => 0);
    c.takeovers = [];
  }
  c.actor = actorOf(room.game);
  c.since = now;
}
export function assertClockOpen(room, now = Date.now()) {
  const c = clockView(room, now);
  if (c.blocked)
    throw new RuleError(
      c.paused
        ? "The table is paused. The host can resume in Turn timers."
        : c.config.expiry === "auto"
          ? "Time expired. AI is completing this decision; the host can pause or add time in Turn timers."
          : "The timer has expired. The host can add time in Turn timers.",
    );
}
export function changeClock(room, p, input, now = Date.now()) {
  if (p !== 0)
    throw Object.assign(new Error("Only the host can change table timers."), {
      status: 403,
    });
  // Validate first so a malformed command cannot partially settle the clock.
  const config =
    input.operation === "configure" ? validateTimer(input.config) : null;
  if (!["configure", "pause", "resume", "extend"].includes(input.operation))
    throw new RuleError("Choose a valid timer control.");
  if (
    input.operation === "extend" &&
    (!Number.isInteger(input.seconds) ||
      input.seconds < 30 ||
      input.seconds > 86400)
  )
    throw new RuleError("Add between 30 seconds and 24 hours.");
  settleClock(room, now);
  const c = room.clock;
  if (input.operation === "configure") {
    c.config = config;
    room.options.timer = config;
    c.spent = room.seats.map(() => 0);
    c.bonus = room.seats.map(() => 0);
    c.paused = false;
    c.takeovers = [];
  }
  if (input.operation === "pause") c.paused = true;
  if (input.operation === "resume") c.paused = false;
  if (input.operation === "extend") {
    if (c.actor === null || c.config.mode === "off")
      throw new RuleError("Start a timed game before adding time.");
    c.bonus[c.actor] = (c.bonus[c.actor] ?? 0) + input.seconds * 1000;
  }
  const text =
    input.operation === "configure"
      ? `Timer set to ${config.mode === "off" ? "untimed" : `${config.seconds / 60} minutes per turn (${config.mode})`}. Current allowance restarted.`
      : input.operation === "extend"
        ? `Host added ${input.seconds / 60} minutes to ${room.seats[c.actor].name}'s current clock.`
        : `Host ${input.operation === "pause" ? "paused" : "resumed"} the table.`;
  room.notices = [...(room.notices ?? []), { text, at: now }].slice(-20);
}
