import { useRef } from "react";

export default function PlayerGestureLayer({ onForward, onBackward, onSpeedStart, onSpeedEnd }) {
  const lastTapRef = useRef(0);
  const pressTimerRef = useRef(null);

  const handleTap = (e) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isRight = x > rect.width / 2;

    if (now - lastTapRef.current < 300) {
      if (isRight) onForward();
      else onBackward();
    }
    lastTapRef.current = now;
  };

  const handlePressStart = () => {
    pressTimerRef.current = setTimeout(() => onSpeedStart(), 350);
  };

  const handlePressEnd = () => {
    clearTimeout(pressTimerRef.current);
    onSpeedEnd();
  };

  return (
    <div
      className="gesture-layer"
      onClick={handleTap}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
    />
  );
}