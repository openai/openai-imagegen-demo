import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Loader2,
  RefreshCcw,
  Play,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "../ui";
import {
  formatDateTime,
  formatDurationMinutes,
  formatProgressPercent,
} from "../utils/formatters";
import {
  ensurePrompt,
  isCompletedStatus,
  isFailedStatus,
  type VideoItem,
  type VideoStatus,
} from "../utils/video";

type AsyncMaybe = void | Promise<unknown>;

export interface VideoCardProps {
  item: VideoItem;
  thumbnailUrl?: string;
  onDownload: (item: VideoItem) => AsyncMaybe;
  onPlayPreview: (item: VideoItem) => AsyncMaybe;
  onRemix: (item: VideoItem) => AsyncMaybe;
  onRetry: (item: VideoItem) => AsyncMaybe;
  onRefresh: (item: VideoItem) => AsyncMaybe;
  onRemove: (item: VideoItem) => AsyncMaybe;
  isRefreshing: boolean;
  isPreviewing: boolean;
  previewLoading: boolean;
}

const extractErrorReason = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const candidate = error as { message?: unknown; code?: unknown };
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
    if (typeof candidate.code === "string" && candidate.code.trim()) {
      return candidate.code;
    }
  }
  return undefined;
};

const STATUS_BADGE_META: Record<string, { label: string; className: string }> =
  {
    completed: {
      label: "Ready",
      className:
        "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    },
    succeeded: {
      label: "Ready",
      className:
        "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    },
    queued: {
      label: "Queued",
      className: "border border-blue-500/30 bg-blue-500/10 text-blue-500",
    },
    in_progress: {
      label: "Processing",
      className: "border border-amber-500/30 bg-amber-500/10 text-amber-500",
    },
    failed: {
      label: "Failed",
      className:
        "border border-destructive/40 bg-destructive/10 text-destructive",
    },
  };

const formatStatusLabel = (status: string): string =>
  status
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ") || "Unknown";

const getStatusBadgeMeta = (status: VideoStatus | null | undefined) => {
  const normalized = (status || "unknown").toLowerCase();
  const fallback = {
    label: status ? formatStatusLabel(status) : "Unknown",
    className: "border border-border/60 bg-muted/60 text-muted-foreground",
  };
  return STATUS_BADGE_META[normalized] ?? fallback;
};

const VideoCard = ({
  item,
  thumbnailUrl,
  onDownload,
  onPlayPreview,
  onRemix,
  onRetry,
  onRefresh,
  onRemove,
  isRefreshing,
  isPreviewing,
  previewLoading,
}: VideoCardProps) => {
  const [copiedKey, setCopiedKey] = useState<"id" | "prompt" | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  if (!item) return null;

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

  const showCompletedMeta = () => {
    if (!item.completedAt) return null;
    const duration = formatDurationMinutes(item.createdAt, item.completedAt);
    return (
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span>Completed {formatDateTime(item.completedAt)}</span>
        {duration ? (
          <>
            <span className="text-muted-foreground/70">•</span>
            <span>{duration}</span>
          </>
        ) : null}
      </div>
    );
  };

  const renderActions = () => {
    if (isCompletedStatus(item.status)) {
      return (
        <>
          <Button
            onClick={() => onDownload(item)}
            size="sm"
            variant="secondary"
            aria-label="Download video"
            className={cn(
              "rounded-full px-3 text-xs font-semibold",
              item.downloaded ? "opacity-60" : ""
            )}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button
            variant="outline"
            onClick={() => onRemix(item)}
            size="sm"
            className="rounded-full border-border px-3 text-xs text-foreground hover:bg-accent"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Remix
          </Button>
        </>
      );
    }

    if (isFailedStatus(item.status)) {
      const reason = extractErrorReason(item.error);

      return (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span>Generation failed</span>
            <Button
              variant="outline"
              onClick={() => onRetry(item)}
              size="sm"
              className="h-7 rounded-full border-destructive/50 px-3 text-[11px] text-destructive hover:bg-destructive/15"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
          {reason ? (
            <div className="text-[11px] text-destructive/90">{reason}</div>
          ) : null}
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Processing…</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRefresh(item)}
          disabled={isRefreshing}
          className="rounded-full border-border px-3 text-[11px] text-foreground hover:bg-accent"
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" />
          )}
          {isRefreshing ? "Refreshing" : "Refresh"}
        </Button>
      </>
    );
  };

  const { label: statusLabel, className: statusClass } = getStatusBadgeMeta(
    item.status
  );

  const progress = formatProgressPercent(item.progress ?? null);
  const showProgress =
    (item.status || "").toLowerCase() === "in_progress" && progress;
  const progressValue = showProgress ? Number(progress) : null;
  const hasValidProgress =
    typeof progressValue === "number" && Number.isFinite(progressValue);
  const progressWidth = hasValidProgress
    ? Math.min(100, Math.max(0, progressValue ?? 0))
    : 0;

  const metaChips = [
    item.seconds ? `${item.seconds}s` : null,
    item.model || null,
    item.size || null,
  ].filter(Boolean) as string[];
  const storedPrompt =
    typeof item.prompt === "string" ? item.prompt.trim() : "";
  const fallbackPrompt = ensurePrompt(item, "");
  const promptText = storedPrompt || fallbackPrompt || "";
  const isPromptFallback = !storedPrompt && Boolean(promptText);

  return (
    <Card className="group relative w-full overflow-hidden rounded-xl border border-border/60 bg-card/80 transition-colors hover:bg-card">
      <CardContent className="p-0">
        <div className="grid gap-0 md:h-[260px] md:grid-cols-[200px_1fr]">
          <div className="relative h-[260px] overflow-hidden border-b border-border/60 bg-muted/60 md:h-full md:border-b-0 md:border-r">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt={`Thumbnail for ${item.title?.trim() || item.id}`}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/70 via-muted/60 to-muted/70 text-muted-foreground"></div>
            )}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition",
                isPreviewing ? "bg-black/25" : "group-hover:bg-black/15"
              )}
            >
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => onPlayPreview(item)}
                disabled={previewLoading && isPreviewing}
                aria-label={
                  thumbnailUrl ? "Preview video" : "Preview video (placeholder)"
                }
                className="pointer-events-auto h-9 w-9 rounded-full border border-border/60 bg-card/90 text-foreground transition hover:scale-[1.02] focus-visible:scale-[1.02]"
              >
                {previewLoading && isPreviewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove video from list"
              onClick={() => onRemove(item)}
              className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="mt-1 mr-4 line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                  {item.title?.trim().replaceAll('"', "") || "Untitled Video"}
                </div>
                <div className="flex justify-start items-center gap-2">
                  <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <span className="max-w-24 truncate">{item.id}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(item.id, "id")}
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
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold uppercase leading-3 tracking-wide",
                      statusClass
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
                {promptText ? (
                  <div className="flex items-start">
                    <p
                      className={cn(
                        "line-clamp-2 min-w-0 flex-1 break-words whitespace-pre-line text-xs",
                        isPromptFallback
                          ? "italic text-muted-foreground"
                          : "text-foreground/90"
                      )}
                    >
                      {promptText}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(promptText, "prompt")}
                      className="shrink-0 gap-2 pb-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Copy prompt"
                    >
                      {copiedKey === "prompt" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ) : null}
                {metaChips.length ? (
                  <div className="flex flex-nowrap items-center gap-2 overflow-x-auto text-[11px] text-muted-foreground">
                    {metaChips.map((chip) => (
                      <span
                        key={chip}
                        className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
                {showCompletedMeta()}
              </div>
            </div>
            {showProgress && hasValidProgress ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-amber-600">
                  <span>Processing {progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300 ease-out"
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {renderActions()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoCard;
