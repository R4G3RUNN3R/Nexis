import { useEffect, useRef, useState } from "react";

export type OrbPosition = {
  x: number;
  y: number;
};

type Props = {
  position: OrbPosition;
  onMove: (position: OrbPosition) => void;
  onClick: () => void;
  title?: string;
};

export default function CielOrb({
  position,
  onMove,
  onClick,
  title = "CIEL",
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [movedDuringDrag, setMovedDuringDrag] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!dragging) return;

      setMovedDuringDrag(true);

      const nextX = Math.max(
        20,
        Math.min(window.innerWidth - 72, event.clientX - offsetRef.current.x),
      );
      const nextY = Math.max(
        20,
        Math.min(window.innerHeight - 72, event.clientY - offsetRef.current.y),
      );

      onMove({ x: nextX, y: nextY });
    };

    const handleUp = () => {
      setDragging(false);
      window.setTimeout(() => setMovedDuringDrag(false), 0);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, onMove]);

  return (
    <button
      type="button"
      className={`ciel-orb-anchor${dragging ? " ciel-orb-anchor--dragging" : ""}`}
      style={{ left: position.x, top: position.y }}
      onMouseDown={(event) => {
        setDragging(true);
        offsetRef.current = {
          x: event.clientX - position.x,
          y: event.clientY - position.y,
        };
      }}
      onClick={() => {
        if (!movedDuringDrag) onClick();
      }}
      title={title}
      aria-label={title}
    >
      <span className="ciel-orb-shell">
        <span className="ciel-orb-core" />
        <span className="ciel-orb-ring ciel-orb-ring--one" />
        <span className="ciel-orb-ring ciel-orb-ring--two" />
        <span className="ciel-orb-spark ciel-orb-spark--one" />
        <span className="ciel-orb-spark ciel-orb-spark--two" />
      </span>
    </button>
  );
}
