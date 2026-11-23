/* Days-left ring for the member page. The arc animates in on first paint. */
import { useEffect, useState } from "react";

export function Ring({ value, max, size = 168, stroke = 12, color = "var(--accent)", number, unit }: { value: number; max: number; size?: number; stroke?: number; color?: string; number: string; unit: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(fraction));
    return () => cancelAnimationFrame(frame);
  }, [fraction]);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
        />
      </svg>
      <div className="ring__label">
        <span className="ring__number">{number}</span>
        <span className="ring__unit">{unit}</span>
      </div>
    </div>
  );
}
