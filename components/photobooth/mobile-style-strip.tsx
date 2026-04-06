import { Button } from "@/components/ui/button";
import { StyleOptionsList } from "@/components/photobooth/style-options-list";
import type { PhotoboothStyleId } from "@/lib/photobooth-styles";

type MobileStyleStripProps = {
  canGenerate: boolean;
  onGenerate: () => void;
  onToggleStyle: (styleId: PhotoboothStyleId) => void;
  selectedStyleIds: PhotoboothStyleId[];
};

export const MobileStyleStrip = ({
  canGenerate,
  onGenerate,
  onToggleStyle,
  selectedStyleIds,
}: MobileStyleStripProps) => (
  <div className="mt-2 space-y-3 lg:hidden">
    <div className="-mx-1 overflow-x-auto pb-3">
      <StyleOptionsList
        compact
        direction="row"
        onToggleStyle={onToggleStyle}
        selectedStyleIds={selectedStyleIds}
      />
    </div>

    <Button
      className="h-11 w-full rounded-xl px-5 text-base"
      disabled={!canGenerate}
      onClick={onGenerate}
    >
      Generate Styles
    </Button>
  </div>
);
