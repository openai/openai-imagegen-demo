import { useEffect } from "react";
import { fetchVideo } from "../services/soraApi";
import { normalizeVideo, type VideoItem } from "../utils/video";

type UpdateFn = (current: VideoItem) => VideoItem;

type UseVideoPollingOptions = {
  items: VideoItem[];
  onUpdate: (id: string, updater: UpdateFn) => void;
};

const shouldPoll = (item: VideoItem | null | undefined): boolean => {
  const status = (item?.status || "").toLowerCase();
  return status === "queued" || status === "in_progress";
};

const useVideoPolling = ({ items, onUpdate }: UseVideoPollingOptions): void => {
  useEffect(() => {
    if (items.length === 0) return undefined;

    const interval = setInterval(async () => {
      for (const item of items) {
        if (!item?.id) continue;
        if (!shouldPoll(item)) continue;
        try {
          const payload = await fetchVideo<Record<string, unknown>>({ videoId: item.id });
          onUpdate(item.id, (current) => normalizeVideo(payload, current));
        } catch {
          // swallow polling errors to keep loop running
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [items, onUpdate]);
};

export default useVideoPolling;
