import { useEffect, useId, useRef, useState } from "react";

type LayerNameModalProps = {
  open: boolean;
  initialValue: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string, file: File | null, coords: { lat: number; lng: number } | null) => void;
  onCancel: () => void;
};

export default function LayerNameModal({
  open,
  initialValue,
  title = "Create Layer",
  confirmLabel = "Create",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: LayerNameModalProps) {
  const [value, setValue] = useState(initialValue);
  const [file, setFile] = useState<File | null>(null);
  const [latValue, setLatValue] = useState("");
  const [lngValue, setLngValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();
  const fileId = useId();
  const latId = useId();
  const lngId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    setValue(initialValue);
    setFile(null);
    setLatValue("");
    setLngValue("");
  }, [initialValue, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open]);

  if (!open) {
    return null;
  }

  const handleConfirm = () => {
    const lat = Number.parseFloat(latValue.trim());
    const lng = Number.parseFloat(lngValue.trim());
    const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    onConfirm(value.trim(), file, coords);
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] w-[min(92vw,360px)] rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-[var(--text)] shadow-[var(--panel-shadow)]"
      >
        <div id={titleId} className="text-[15px] font-semibold">
          {title}
        </div>
        <div className="mt-1 text-[12px] text-[var(--text-muted)]">
          Enter a friendly name to help manage layers.
        </div>

        <label className="mt-3 block text-[11px] font-semibold text-[var(--section-heading)]" htmlFor={inputId}>
          Layer Name
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleConfirm();
            }
          }}
          className="mt-1 h-10 w-full rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-3 text-[14px] font-medium text-[var(--text)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/40"
          placeholder="Layer name"
        />

        <label className="mt-3 block text-[11px] font-semibold text-[var(--section-heading)]" htmlFor={fileId}>
          Model (.glb)
        </label>
        <input
          id={fileId}
          type="file"
          accept=".glb,model/gltf-binary"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-1 block w-full cursor-pointer text-[12px] text-[var(--text-muted)] file:mr-3 file:h-9 file:rounded-md file:border file:border-[var(--btn-border)] file:bg-[var(--btn-bg)] file:px-3 file:text-[13px] file:font-semibold file:text-[var(--text)] file:transition hover:file:border-[var(--btn-border-hover)] hover:file:bg-[var(--btn-hover)]"
        />
        <div className="mt-1 text-[11px] text-[var(--text-muted)]">
          Leave empty to use the default model.
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--section-heading)]" htmlFor={latId}>
              Latitude
            </label>
            <input
              id={latId}
              type="number"
              inputMode="decimal"
              value={latValue}
              onChange={(event) => setLatValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleConfirm();
                }
              }}
              className="mt-1 h-10 w-full rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-3 text-[13px] font-medium text-[var(--text)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/40"
              placeholder="10.8231"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--section-heading)]" htmlFor={lngId}>
              Longitude
            </label>
            <input
              id={lngId}
              type="number"
              inputMode="decimal"
              value={lngValue}
              onChange={(event) => setLngValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleConfirm();
                }
              }}
              className="mt-1 h-10 w-full rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-3 text-[13px] font-medium text-[var(--text)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/40"
              placeholder="106.6297"
            />
          </div>
        </div>
        <div className="mt-1 text-[11px] text-[var(--text-muted)]">
          Optional. Leave empty to place at the current map center.
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-3 text-[13px] font-semibold text-[var(--text)] transition hover:border-[var(--btn-border-hover)] hover:bg-[var(--btn-hover)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="h-9 rounded-md border border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] px-3 text-[13px] font-semibold text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)] transition hover:brightness-105"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
