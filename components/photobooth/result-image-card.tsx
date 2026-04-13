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
  const showPendingIndicator =
    card.status === "queued" || card.status === "streaming";
  const activeImage =
    card.finalImageUrl ?? (showPendingIndicator ? card.partialImageUrl : null);
  const canDownload = card.status === "done" && Boolean(card.finalImageUrl);
  const showCenteredSpinner = showPendingIndicator && !activeImage;
  const showTopRightSpinner = showPendingIndicator && Boolean(activeImage);

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
          <div
            className={cn(
              "pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-300",
              showTopRightSpinner
                ? "translate-y-0 opacity-100"
                : "-translate-y-1 opacity-0",
            )}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </div>

          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300",
              showCenteredSpinner ? "opacity-100" : "opacity-0",
            )}
          >
            <div className="rounded-full bg-background/70 p-2 text-muted-foreground backdrop-blur-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          </div>

          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- Result previews are generated data URLs.
            <img
              src={activeImage}
              alt={`${card.label} result`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {card.status === "error" ? (
                <span className="px-3 text-center text-sm text-destructive">
                  {card.error ?? "Generation failed"}
                </span>
              ) : showCenteredSpinner ? null : (
                <span className="text-sm text-muted-foreground">
                  Generating image...
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      <div className="flex items-center justify-between px-3 py-3">
        <p className="text-base font-medium">{card.label}</p>
        {canDownload ? (
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
