import React, { useRef } from "react";
export const playerWidthLimits = () =>
  innerWidth <= 1000
    ? { min: 30, max: 66 }
    : {
        min: (360 / innerWidth) * 100,
        max: Math.min(66, ((innerWidth - 460) / innerWidth) * 100),
      };
export const clampPlayerWidth = (value) => {
  const { min, max } = playerWidthLimits();
  return Math.min(max, Math.max(min, value));
};
export default function PlayerBoardResize({ width, onChange }) {
  const drag = useRef(null),
    current = width ?? 42.5,
    { min, max } = playerWidthLimits();
  return (
    <div
      className="player-board-resize"
      role="separator"
      aria-label="Resize player board and step panel"
      aria-orientation="vertical"
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(current)}
      aria-valuetext={`Player board ${Math.round(current)} percent`}
      tabIndex={0}
      title="Drag left or right to resize your player board. Arrow keys adjust; Home or double-click resets."
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, width: current };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current)
          onChange(
            clampPlayerWidth(
              drag.current.width +
                ((e.clientX - drag.current.x) / innerWidth) * 100,
            ),
          );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onDoubleClick={() => onChange(null)}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
          e.preventDefault();
          onChange(
            e.key === "Home"
              ? null
              : clampPlayerWidth(current + (e.key === "ArrowRight" ? 3 : -3)),
          );
        }
      }}
    >
      <span />
    </div>
  );
}
