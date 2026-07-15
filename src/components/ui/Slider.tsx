import { useId, type CSSProperties } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Formats the value readout, e.g. (v) => `${v}°`. */
  format?: (value: number) => string;
}

/**
 * Labeled slider row for inspector panels. The filled portion of the track
 * is painted through the `--rf-track` variable consumed by globals.css.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
}: SliderProps) {
  const id = useId();
  const percent = ((value - min) / (max - min)) * 100;

  const trackStyle: CSSProperties = {
    ['--rf-track' as string]: `linear-gradient(to right, var(--rf-accent) ${percent}%, var(--rf-surface-active) ${percent}%)`,
  };

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs text-secondary">
          {label}
        </label>
        <span className="text-[11px] font-medium text-primary tabular-nums">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={trackStyle}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
