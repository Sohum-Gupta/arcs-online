import React, { useState, useEffect } from "react";
export function duration(ms) {
  const n = Math.ceil(Math.abs(ms) / 1000),
    h = Math.floor(n / 3600),
    m = Math.floor((n % 3600) / 60),
    s = n % 60;
  return `${ms < 0 ? "+" : ""}${h ? `${h}h ` : ""}${m}:${String(s).padStart(2, "0")}`;
}
export function useClock(clock) {
  const [now, setNow] = useState(() => ({
    source: clock,
    at: performance.now(),
    tick: performance.now(),
  }));
  useEffect(() => {
    setNow({ source: clock, at: performance.now(), tick: performance.now() });
    const timer = setInterval(
      () => setNow((s) => ({ ...s, tick: performance.now() })),
      500,
    );
    return () => clearInterval(timer);
  }, [clock]);
  if (!clock) return null;
  const dt =
    now.source === clock &&
    !clock.paused &&
    !clock.complete &&
    clock.actor !== null
      ? now.tick - now.at
      : 0;
  const remaining = clock.remainingMs === null ? null : clock.remainingMs - dt;
  const pauseExpiry =
    ["pause", "auto"].includes(clock.config.expiry) &&
    remaining !== null &&
    remaining <= 0;
  const elapsed = pauseExpiry ? Math.max(0, clock.remainingMs) : dt;
  return {
    ...clock,
    remainingMs: pauseExpiry ? 0 : remaining,
    blocked: clock.blocked || pauseExpiry,
    spent: clock.spent.map((v, i) => v + (i === clock.actor ? elapsed : 0)),
    total: clock.total.map((v, i) => v + (i === clock.actor ? elapsed : 0)),
  };
}
export function ClockChip({ clock, onClick }) {
  const c = useClock(clock);
  if (!c) return null;
  return (
    <button
      className={`clock-chip ${c.blocked ? "paused" : c.remainingMs !== null && c.remainingMs < 30000 ? "urgent" : ""}`}
      onClick={onClick}
      aria-label="Turn timers"
    >
      <span>◷</span>
      <span>
        {c.paused
          ? "Table paused"
          : c.blocked
            ? c.config.expiry === "auto"
              ? "AI finishing turn"
              : "Time expired"
            : c.complete
              ? "Game complete"
              : c.remainingMs === null
                ? "Untimed"
                : duration(c.remainingMs)}
        <small>
          {c.remainingMs < 0 ? "Overtime · turn timer" : "Turn timers"}
        </small>
      </span>
    </button>
  );
}
export default function TurnTimers({ room, onControl, busy, error }) {
  const c = useClock(room.clock),
    config = c?.config ?? { mode: "off", seconds: 300, expiry: "auto" };
  const [mode, setMode] = useState(config.mode),
    [amount, setAmount] = useState(
      config.mode === "async"
        ? config.seconds / 3600
        : config.seconds / 60 || 5,
    ),
    [expiry, setExpiry] = useState(config.expiry);
  return (
    <>
      <span className="eyebrow gold">PACE OF PLAY</span>
      <h2>Turn timers</h2>
      <p>
        One allowance per card turn, from choosing your card through
        confirmation. Actions, Back, Undo, and Redo never restart it. During
        another player’s response, only their clock runs.
      </p>
      {c && (
        <>
          <div className="timer-hero">
            <strong>
              {c.paused
                ? "Paused"
                : c.blocked
                  ? c.config.expiry === "auto"
                    ? "AI finishing turn"
                    : "Time expired"
                  : c.remainingMs === null
                    ? "Untimed"
                    : duration(c.remainingMs)}
            </strong>
            <span>
              {c.actor === null
                ? "No active decision"
                : `${room.seats[c.actor]?.name} is resolving a decision`}
            </span>
          </div>
          <div className="timer-players">
            {room.seats.map((p, i) => (
              <div key={i} className={i === c.actor ? "active" : ""}>
                <strong>
                  {p.name}
                  {i === c.actor ? " · active" : ""}
                </strong>
                <span>{duration(c.spent[i] ?? 0)} this turn</span>
                <small>{duration(c.total[i] ?? 0)} total decision time</small>
              </div>
            ))}
          </div>
        </>
      )}
      {room.host ? (
        <>
          <div className="timer-controls">
            <button
              disabled={busy}
              onClick={() =>
                onControl({ operation: c?.paused ? "resume" : "pause" })
              }
            >
              {c?.paused ? "Resume table" : "Pause table"}
            </button>
            <button
              disabled={busy || config.mode === "off" || c?.actor === null}
              onClick={() =>
                onControl({
                  operation: "extend",
                  seconds: config.mode === "async" ? 3600 : 60,
                })
              }
            >
              Add {config.mode === "async" ? "1 hour" : "1 minute"}
            </button>
          </div>
          <fieldset className="timer-settings" disabled={busy}>
            <legend>Host settings</legend>
            <label htmlFor="timer-mode">Mode</label>
            <select
              id="timer-mode"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                if (mode === "off") setExpiry("auto");
                setAmount(e.target.value === "async" ? 24 : 5);
              }}
            >
              <option value="off">Untimed</option>
              <option value="live">Live · minutes per turn</option>
              <option value="async">Asynchronous · hours per turn</option>
            </select>
            {mode !== "off" && (
              <>
                <label>
                  {mode === "async" ? "Hours" : "Minutes"} per turn
                  <input
                    type="number"
                    min="1"
                    max={mode === "async" ? 168 : 60}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  When time runs out
                  <select
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  >
                    <option value="auto">AI finishes the turn</option>
                    <option value="overtime">Show overtime · allow play</option>
                    <option value="pause">Stop play · host adds time</option>
                  </select>
                </label>
              </>
            )}
            <p>
              Applying settings restarts the current allowance for everyone.
              Pausing stops play and clocks. Disconnection does not pause a
              clock. With AI completion, expiry commits the remaining legal
              decisions and passes play onward. AI preserves saved resources and
              favors conservative actions. It never forfeits a player. Pause or
              add time to interrupt automatic play.
            </p>
            <button
              className="primary full"
              onClick={() =>
                onControl({
                  operation: "configure",
                  config: {
                    mode,
                    expiry,
                    seconds:
                      mode === "off"
                        ? 0
                        : Number(amount) * (mode === "async" ? 3600 : 60),
                  },
                })
              }
            >
              Apply timer settings
            </button>
          </fieldset>
        </>
      ) : (
        <p>The host controls timer settings, pauses, and extra time.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {room.notices?.length > 0 && (
        <details className="timer-notices">
          <summary>Timer activity</summary>
          {[...room.notices].reverse().map((n, i) => (
            <p key={i}>{n.text}</p>
          ))}
        </details>
      )}
    </>
  );
}
