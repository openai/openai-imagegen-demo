import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResultCard } from "@/types/photobooth";

type ResultImageCardProps = {
  card: ResultCard;
  onDownload: (card: ResultCard) => void;
  onOpenPreview: (card: ResultCard) => void;
};

export const ResultImageCard = ({
  card,
  onDownload,
  onOpenPreview,
}: ResultImageCardProps) => {
  const activeImage = card.finalImageUrl ?? card.partialImageUrl;
  const showSpinner = card.status === "queued" || card.status === "streaming";

  return (
    <article className="group overflow-hidden rounded-2xl border bg-card/90 shadow-sm">
      <button
        type="button"
        className={cn(
          "block w-full text-left",
          activeImage ? "cursor-zoom-in" : "cursor-default",
        )}
        onClick={() => {
          if (!activeImage) return;
          onOpenPreview(card);
        }}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          {activeImage ? (
            <img
              src={activeImage}
              alt={`${card.label} result`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {showSpinner ? (
                <Loader2 className="animate-spin text-muted-foreground" />
              ) : card.status === "error" ? (
                <span className="px-3 text-center text-sm text-destructive">
                  {card.error ?? "Generation failed"}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Waiting for output
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      <div className="flex items-center justify-between px-3 py-3">
        <p className="text-base font-medium">{card.label}</p>
        {activeImage ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDownload(card)}
          >
            <Download data-icon="inline-start" />
            Download
          </Button>
        ) : null}
      </div>
    </article>
  );
};

