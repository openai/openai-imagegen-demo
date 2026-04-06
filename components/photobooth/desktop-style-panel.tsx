import { Button } from "@/components/ui/button";
import { StyleOptionsList } from "@/components/photobooth/style-options-list";
import type { PhotoboothStyleId } from "@/lib/photobooth-styles";

type DesktopStylePanelProps = {
  canGenerate: boolean;
  onGenerate: () => void;
  onToggleStyle: (styleId: PhotoboothStyleId) => void;
  selectedStyleIds: PhotoboothStyleId[];
};

export const DesktopStylePanel = ({
  canGenerate,
  onGenerate,
  onToggleStyle,
  selectedStyleIds,
}: DesktopStylePanelProps) => (
  <aside className="hidden h-full w-1/5 min-w-[260px] max-w-[340px] overflow-hidden rounded-3xl border bg-card/90 lg:block">
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <StyleOptionsList
          onToggleStyle={onToggleStyle}
          selectedStyleIds={selectedStyleIds}
        />
      </div>

      <div className="p-3">
        <Button
          className="h-11 w-full rounded-xl px-5 text-base"
          disabled={!canGenerate}
          onClick={onGenerate}
        >
          Generate Styles
        </Button>
      </div>
    </div>
  </aside>
);
