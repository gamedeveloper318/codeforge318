import { useState } from "react";

interface SashProps {
  direction: "vertical" | "horizontal";
  /** Called with the pointer delta (px) since the drag started. */
  onResize: (delta: number) => void;
  onEnd?: () => void;
}

/** A thin drag handle that resizes the side bar or the panel. */
export function Sash({ direction, onResize, onEnd }: SashProps) {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const start = direction === "vertical" ? event.clientX : event.clientY;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setDragging(true);
    const move = (e: PointerEvent) =>
      onResize((direction === "vertical" ? e.clientX : e.clientY) - start);
    const up = () => {
      setDragging(false);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      onEnd?.();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  return (
    <div
      className={`sash ${direction}${dragging ? " dragging" : ""}`}
      onPointerDown={onPointerDown}
    />
  );
}
