import type { LayerOption } from "@/types/common";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faEye,
  faEyeSlash,
  faLocationDot,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

interface Props {
  layers: LayerOption[];
  activeLayerId: string;
  visibility: Record<string, boolean>;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onDeleteLayer: (id: string) => void;
  onJumpToLayer: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export default function LayerPanel({
  layers,
  activeLayerId,
  visibility,
  onSelectLayer,
  onToggleVisibility,
  onDeleteLayer,
  onJumpToLayer,
  onShowAll,
  onHideAll,
  isOpen,
  onToggleOpen,
}: Props) {
  const panelClassName =
    "absolute left-4 top-20 z-[2000] w-[280px] overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text)] shadow-[var(--panel-shadow)]";
  const headerClassName =
    "sticky top-0 z-10 flex items-center justify-between border-b border-[var(--divider)] bg-[var(--panel-bg)]/95 px-3 py-2 backdrop-blur";
  const titleClassName = "text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const headerActionsClassName = "flex items-center gap-1";
  const headerButtonClassName =
    "flex h-7 w-7 items-center justify-center rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] text-[12px] text-[var(--text)] transition hover:-translate-y-px hover:border-[var(--btn-border-hover)] hover:bg-[var(--btn-hover)]";
  const listClassName =
    "layer-panel-scroll flex max-h-[calc(100vh-220px)] flex-col gap-1.5 overflow-y-auto px-2.5 py-2.5";
  const rowClassName =
    "group flex items-center gap-2 rounded-lg border border-[var(--seg-border)] bg-[var(--seg-bg)] px-2 py-1.5 transition hover:border-[var(--btn-border-hover)] hover:bg-[var(--seg-hover)] hover:text-[var(--text)]";
  const rowActiveClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)]";
  const nameClassName = "flex-1 text-[11px] font-semibold leading-tight text-[var(--text)]";
  const buttonBaseClassName =
    "flex h-7 w-7 items-center justify-center rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] text-[12px] text-[var(--text)] transition hover:-translate-y-px hover:border-[var(--btn-border-hover)] hover:bg-[var(--btn-hover)]";
  const buttonActiveClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)]";
  const deleteButtonClassName =
    "border-[var(--btn-danger-border)] bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] hover:!border-[var(--btn-danger-hover)] hover:!bg-[var(--btn-danger-hover)]";
  const badgeClassName =
    "mt-0.5 text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const indicatorBaseClassName = "h-3.5 w-3.5 rounded-full";
  const indicatorActiveClassName = "bg-[var(--btn-active-bg)]";
  const indicatorInactiveClassName = "border border-[var(--btn-border)] bg-transparent";

  return (
    <div className={panelClassName} aria-label="Layer panel">
      <div className={headerClassName}>
        <div className={titleClassName}>Layers</div>
        <div className={headerActionsClassName}>
          <button
            className={headerButtonClassName}
            onClick={onShowAll}
            title="Show all layers"
            aria-label="Show all layers"
            type="button"
          >
            <FontAwesomeIcon icon={faEye} />
          </button>
          <button
            className={headerButtonClassName}
            onClick={onHideAll}
            title="Hide all layers"
            aria-label="Hide all layers"
            type="button"
          >
            <FontAwesomeIcon icon={faEyeSlash} />
          </button>
          <button
            className={headerButtonClassName}
            onClick={onToggleOpen}
            title={isOpen ? "Collapse panel" : "Expand panel"}
            aria-label={isOpen ? "Collapse panel" : "Expand panel"}
            type="button"
          >
            <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} />
          </button>
        </div>
      </div>
      {isOpen ? (
        <div className={listClassName}>
        {layers.map((layer) => {
          const isActive = activeLayerId === layer.id;
          const isVisible = visibility[layer.id] ?? true;
          const isBase = layer.id === "models";
          return (
            <div
              key={layer.id}
              className={`${rowClassName} ${isActive ? rowActiveClassName : ""}`}
              onClick={() => onSelectLayer(layer.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectLayer(layer.id);
                }
              }}
            >
              <button
                className={buttonBaseClassName}
                onClick={() => onSelectLayer(layer.id)}
                title="Select layer"
                aria-label="Select layer"
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <span
                  className={`${indicatorBaseClassName} ${
                    isActive ? indicatorActiveClassName : indicatorInactiveClassName
                  }`}
                />
              </button>
              <div className={nameClassName}>
                {layer.label}
                {isBase ? <div className={badgeClassName}>Base</div> : null}
              </div>
              <button
                className={`${buttonBaseClassName} ${isVisible ? buttonActiveClassName : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleVisibility(layer.id, !isVisible);
                }}
                title={isVisible ? "Hide layer" : "Show layer"}
                aria-label={isVisible ? "Hide layer" : "Show layer"}
                type="button"
              >
                <FontAwesomeIcon icon={isVisible ? faEye : faEyeSlash} />
              </button>
              <button
                className={buttonBaseClassName}
                onClick={(event) => {
                  event.stopPropagation();
                  onJumpToLayer(layer.id);
                }}
                title={isBase ? "Base layer cannot jump" : "Jump to layer"}
                aria-label={isBase ? "Base layer cannot jump" : "Jump to layer"}
                type="button"
                disabled={isBase}
              >
                <FontAwesomeIcon icon={faLocationDot} />
              </button>
              <button
                className={`${buttonBaseClassName} ${deleteButtonClassName}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteLayer(layer.id);
                }}
                title={isBase ? "Base layer cannot be deleted" : "Delete layer"}
                aria-label={isBase ? "Base layer cannot be deleted" : "Delete layer"}
                type="button"
                disabled={isBase}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          );
        })}
        </div>
      ) : null}
    </div>
  );
}
