import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ensurePrompt, type VideoItem } from "../utils/video";

type AsyncMaybe = void | Promise<unknown>;

export interface VideoPreviewOverlayProps {
  isOpen: boolean;
  item: VideoItem | null;
  previewUrl: string | null;
  loading: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onDownload?: (item: VideoItem) => AsyncMaybe;
}

const VideoPreviewOverlay = ({
  isOpen,
  item,
  previewUrl,
  loading,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onDownload,
}: VideoPreviewOverlayProps) => {
  const [downloading, setDownloading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<"id" | "prompt" | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && hasPrev) {
        event.preventDefault();
        onPrev();
      } else if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onNext();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasNext, hasPrev, isOpen, onClose, onNext, onPrev]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    setVideoDimensions(null);
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleDownloadClick = async () => {
    if (!onDownload || !item?.id) return;
    setDownloading(true);
    try {
      await onDownload(item);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async (
    value: string | null | undefined,
    key: "id" | "prompt"
  ) => {
    const text = (value ?? "").toString().trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopiedKey(null), 1500);
    } catch (error) {
      console.error("Failed to copy text", error);
    }
  };

  const metaChips = [
    item?.seconds ? `${item.seconds}s` : null,
    item?.model || null,
    item?.size || null,
  ].filter(Boolean) as string[];

  const storedPrompt = item?.prompt?.toString().trim() || "";
  const fallbackPrompt = ensurePrompt(item ?? undefined, "");
  const promptText = storedPrompt || fallbackPrompt || "";
  const isPromptFallback = !storedPrompt && Boolean(promptText);

  const renderVideoArea = () => {
    if (previewUrl) {
      const aspectRatio = videoDimensions
        ? `${videoDimensions.width} / ${videoDimensions.height}`
        : undefined;

      return (
        <div
          className="flex max-h-full max-w-full items-center justify-center"
          style={
            aspectRatio
              ? { aspectRatio, maxHeight: "100%", maxWidth: "100%" }
              : { width: "100%", height: "100%" }
          }
        >
          <video
            key={previewUrl}
            src={previewUrl}
            controls
            onLoadedMetadata={(event) => {
              const { videoWidth, videoHeight } = event.currentTarget;
              if (videoWidth && videoHeight) {
                setVideoDimensions({ width: videoWidth, height: videoHeight });
              }
            }}
            className="max-h-full max-w-full rounded-lg bg-black"
          />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted text-sm text-muted-foreground">
        {loading ? "Loading preview…" : "Preview not available."}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 px-4 py-8 backdrop-blur"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/90 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
          <div className="min-w-0 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Previewing
            </div>
            <div className="line-clamp-2 text-xl font-semibold leading-6 text-foreground">
              {item?.title?.trim() || "Untitled Video"}
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <span className="max-w-[16rem] truncate">{item?.id}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(item?.id, "id")}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                aria-label="Copy video id"
              >
                {copiedKey === "id" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            {metaChips.length ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {metaChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-muted/60 px-2 py-0.5"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadClick}
              disabled={!item?.id || !onDownload || downloading}
              className="rounded-full px-3 text-xs"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="relative flex flex-1 min-h-[320px] w-full items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-black">
            {renderVideoArea()}
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 md:pl-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={hasPrev ? onPrev : undefined}
                disabled={!hasPrev}
                className="pointer-events-auto h-10 w-10 rounded-full border border-border/60 bg-background/80 text-foreground shadow transition hover:bg-background"
                aria-label="Previous preview"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 md:pr-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={hasNext ? onNext : undefined}
                disabled={!hasNext}
                className="pointer-events-auto h-10 w-10 rounded-full border border-border/60 bg-background/80 text-foreground shadow transition hover:bg-background"
                aria-label="Next preview"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {promptText ? (
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompt
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(promptText, "prompt")}
                  className="h-7 gap-2 rounded-full text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Copy prompt"
                >
                  {copiedKey === "prompt" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy prompt
                </Button>
              </div>
              <p
                className={cn(
                  "whitespace-pre-line text-sm leading-5",
                  isPromptFallback
                    ? "italic text-muted-foreground"
                    : "text-foreground/90"
                )}
              >
                {promptText}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default VideoPreviewOverlay;
