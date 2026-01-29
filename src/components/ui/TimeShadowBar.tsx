import { useMemo } from "react";

type TimeShadowBarProps = {
  minutes: number;
  date: Date;
  onChange: (minutes: number) => void;
  onClose: () => void;
};

const minuteMax = 24 * 60 - 1;

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(minuteMax, Math.max(0, Math.round(value)));
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${period}`;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${mins.toString().padStart(2, "0")} ${period}`;
}

export default function TimeShadowBar({ minutes, date, onChange, onClose }: TimeShadowBarProps) {
  const clampedMinutes = clampMinutes(minutes);
  const percent = (clampedMinutes / minuteMax) * 100;
  const labels = useMemo(() => Array.from({ length: 24 }, (_, hour) => formatHourLabel(hour)), []);
  const dateLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div
      className="absolute bottom-4 left-1/2 z-2100 flex w-[min(980px,calc(100%-160px))] -translate-x-1/2 flex-col gap-2 rounded-xl border border-(--timebar-border) bg-(--timebar-bg) px-4 py-2 text-(--timebar-text) shadow-(--timebar-shadow)"
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-(--timebar-muted)">
          Shadow Time
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-(--timebar-pill-border) bg-(--timebar-pill-bg) px-2 py-0.5 text-[10px] font-semibold text-(--timebar-text)">
            {dateLabel}
          </span>
          <span className="rounded-full border border-(--timebar-pill-border) bg-(--timebar-pill-bg) px-2 py-0.5 text-[10px] font-semibold text-(--timebar-accent)">
            {formatTime(clampedMinutes)}
          </span>
          <button
            type="button"
            className="ml-2 rounded-full border border-(--timebar-pill-border) bg-(--timebar-pill-bg) px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-(--timebar-text) transition hover:brightness-110"
            onClick={onClose}
          >
            Hide
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.12em] text-(--timebar-muted)">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <input
        className="time-slider"
        type="range"
        min={0}
        max={minuteMax}
        step={5}
        value={clampedMinutes}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        style={{
          background: `linear-gradient(90deg, var(--timebar-fill) ${percent}%, var(--timebar-track) ${percent}%)`,
        }}
      />
    </div>
  );
}
