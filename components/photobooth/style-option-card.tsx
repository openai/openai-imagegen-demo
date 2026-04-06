import { cn } from "@/lib/utils";
import type { PhotoboothStyle } from "@/lib/photobooth-styles";

type StyleOptionCardProps = {
  compact?: boolean;
  disabledTooltip?: string;
  isDisabled: boolean;
  isSelected: boolean;
  onToggle: (styleId: PhotoboothStyle["id"]) => void;
  style: PhotoboothStyle;
};

export const StyleOptionCard = ({
  compact = false,
  disabledTooltip,
  isDisabled,
  isSelected,
  onToggle,
  style,
}: StyleOptionCardProps) => (
  <div
    className={cn(
      "group relative",
      compact ? "w-[220px] shrink-0 sm:w-[240px]" : "",
      isDisabled ? "cursor-not-allowed" : "",
    )}
  >
    <button
      type="button"
      onClick={() => onToggle(style.id)}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-pressed={isSelected}
      title={isDisabled ? disabledTooltip : undefined}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border bg-background/90 hover:bg-accent",
        isDisabled ? "cursor-not-allowed opacity-60" : "",
      )}
    >
      <p className="text-sm font-medium">{style.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{style.description}</p>
    </button>

    {isDisabled && disabledTooltip ? (
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg group-hover:block">
        {disabledTooltip}
      </div>
    ) : null}
  </div>
);

