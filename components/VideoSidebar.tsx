import { useMemo } from "react";
import { Download, Loader2, X, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import VideoCard from "./VideoCard";
import { isCompletedStatus, type VideoItem } from "../utils/video";

type AsyncMaybe = void | Promise<unknown>;

export type SidebarPreviewState = {
  previewingId: string | null;
  previewLoading: boolean;
};

export interface VideoSidebarProps {
  items: VideoItem[];
  thumbnails: Record<string, string>;
  onDownloadAll: () => void;
  downloadingAll: boolean;
  onDownload: (item: VideoItem) => AsyncMaybe;
  onPlayPreview: (item: VideoItem) => AsyncMaybe;
  onRemix: (item: VideoItem) => AsyncMaybe;
  onRetry: (item: VideoItem) => AsyncMaybe;
  onRefresh: (item: VideoItem) => AsyncMaybe;
  onRemove: (item: VideoItem) => AsyncMaybe;
  refreshingMap: Record<string, boolean>;
  previewState: SidebarPreviewState;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const VideoSidebar = ({
  items,
  thumbnails,
  onDownloadAll,
  downloadingAll,
  onDownload,
  onPlayPreview,
  onRemix,
  onRetry,
  onRefresh,
  onRemove,
  refreshingMap,
  previewState,
  isMobileOpen,
  onMobileClose,
}: VideoSidebarProps) => {
  const hasDownloadable = useMemo(
    () =>
      items.some(
        (item) => item?.id && isCompletedStatus(item.status) && !item.downloaded
      ),
    [items]
  );

  const downloadHint = downloadingAll
    ? "Downloading completed videos…"
    : "Downloads may expire after one hour.";

  return (
    <aside
      className={cn(
        "order-1 h-screen w-full flex-none overflow-y-auto border-b border-border/60 bg-card/90 backdrop-blur-sm shadow-sm transition-all lg:order-1 lg:h-screen lg:max-h-screen lg:w-[30rem] lg:border-b-0 lg:border-r lg:border-border/60 lg:shadow-none xl:w-[32rem] lg:sticky lg:top-0",
        isMobileOpen ? "fixed inset-0 z-50 flex" : "hidden",
        "lg:flex lg:flex-col"
      )}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-5">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Library
            </div>
            <div className="text-xl font-semibold text-foreground">
              Your generations
            </div>
            <div className="text-xs text-muted-foreground">{downloadHint}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onDownloadAll}
              disabled={downloadingAll || !hasDownloadable}
              className="hidden rounded-full whitespace-nowrap lg:inline-flex"
            >
              {downloadingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDownloadAll}
              disabled={downloadingAll || !hasDownloadable}
              className="inline-flex whitespace-nowrap lg:hidden"
            >
              {downloadingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMobileClose}
              className="-mr-1 text-muted-foreground hover:text-foreground lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-3 py-4">
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center px-2 py-6">
              <Empty className="max-w-sm border-none bg-transparent shadow-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PlayCircle className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No videos generated yet</EmptyTitle>
                  <EmptyDescription>
                    Start by generating videos to see them appear in your
                    library.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <VideoCard
                  key={item.id}
                  item={item}
                  thumbnailUrl={thumbnails[item.id]}
                  onDownload={onDownload}
                  onPlayPreview={onPlayPreview}
                  onRemix={onRemix}
                  onRetry={onRetry}
                  onRefresh={onRefresh}
                  onRemove={onRemove}
                  isRefreshing={Boolean(refreshingMap[item.id])}
                  isPreviewing={previewState.previewingId === item.id}
                  previewLoading={previewState.previewLoading}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default VideoSidebar;
