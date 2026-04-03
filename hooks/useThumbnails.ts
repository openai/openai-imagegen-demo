import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { fetchVideoContent } from "../services/soraApi";
import type { VideoItem } from "../utils/video";

type UseThumbnailsOptions = {
  items: VideoItem[];
};

type ThumbnailMap = Record<string, string>;

type InFlightMap = Record<string, Promise<void> | null | undefined>;

const useThumbnails = ({ items }: UseThumbnailsOptions): ThumbnailMap => {
  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({});
  const inFlightRef = useRef<InFlightMap>({});
  const thumbnailsRef = useRef<ThumbnailMap>({});

  useEffect(() => {
    thumbnailsRef.current = thumbnails;
  }, [thumbnails]);

  useEffect(() => () => {
    Object.values(thumbnailsRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }, []);

  const fetchThumbnail = useCallback(async (id: string): Promise<string> => {
    const blob = await fetchVideoContent({ videoId: id, variant: "thumbnail" });
    return URL.createObjectURL(blob);
  }, []);

  useEffect(() => {
    if (!items.length) return;

    const validIds = new Set(items.map((it) => it?.id).filter((id): id is string => Boolean(id)));
    Object.keys(inFlightRef.current).forEach((id) => {
      if (!validIds.has(id)) {
        delete inFlightRef.current[id];
      }
    });

    setThumbnails((prev) => {
      let changed = false;
      const next: ThumbnailMap = {};
      Object.entries(prev).forEach(([id, url]) => {
        const keep = validIds.has(id);
        if (keep) {
          next[id] = url;
        } else {
          changed = true;
          if (url) URL.revokeObjectURL(url);
        }
      });
      return changed ? next : prev;
    });

    for (const item of items) {
      const id = item?.id;
      if (!id) continue;
      if (thumbnailsRef.current[id]) continue;
      if (inFlightRef.current[id]) continue;
      inFlightRef.current[id] = fetchThumbnail(id)
        .then((url) => {
          setThumbnails((prev) => {
            const previousUrl = prev[id];
            if (previousUrl) URL.revokeObjectURL(previousUrl);
            return { ...prev, [id]: url };
          });
        })
        .catch(() => {
          // ignore thumbnail failures
        })
        .finally(() => {
          delete inFlightRef.current[id];
        });
    }
  }, [items, fetchThumbnail]);

  return thumbnails;
};

export default useThumbnails;
