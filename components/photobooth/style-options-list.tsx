import { StyleOptionCard } from "@/components/photobooth/style-option-card";
import {
  MAX_SELECTED_STYLES,
  STYLE_LIMIT_TOOLTIP,
} from "@/lib/constants";
import {
  PHOTOBOOTH_STYLES,
  type PhotoboothStyleId,
} from "@/lib/photobooth-styles";
import { cn } from "@/lib/utils";

type StyleOptionsListProps = {
  compact?: boolean;
  direction?: "row" | "column";
  onToggleStyle: (styleId: PhotoboothStyleId) => void;
  selectedStyleIds: PhotoboothStyleId[];
};

export const StyleOptionsList = ({
  compact = false,
  direction = "column",
  onToggleStyle,
  selectedStyleIds,
}: StyleOptionsListProps) => (
  <div
    className={cn(
      "gap-3",
      direction === "row" ? "flex min-w-max px-1" : "flex flex-col",
    )}
  >
    {PHOTOBOOTH_STYLES.map((style) => {
      const isSelected = selectedStyleIds.includes(style.id);
      const isDisabled =
        selectedStyleIds.length >= MAX_SELECTED_STYLES && !isSelected;

      return (
        <StyleOptionCard
          key={style.id}
          compact={compact}
          disabledTooltip={STYLE_LIMIT_TOOLTIP}
          isDisabled={isDisabled}
          isSelected={isSelected}
          onToggle={onToggleStyle}
          style={style}
        />
      );
    })}
  </div>
);

