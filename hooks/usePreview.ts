import { useCallback, useEffect, useRef, useState } from "react";
import { fetchVideoContent } from "../services/soraApi";

export interface PreviewState {
  previewUrl: string | null;
  previewingId: string | null;
  previewLoading: boolean;
  playPreview: (videoId: string) => Promise<void>;
  clearPreview: () => void;
  prefetchPreviews: (videoIds: string[]) => Promise<void>;
}

const usePreview = (): PreviewState => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const cacheRef = useRef<Record<string, string>>({});
  const inFlightRef = useRef<Record<string, Promise<string | null> | null>>({});

  const clearPreview = useCallback(() => {
    setPreviewUrl(null);
    setPreviewingId(null);
  }, []);

  const revokeUrl = useCallback((id: string) => {
    const url = cacheRef.current[id];
    if (!url) return;
    URL.revokeObjectURL(url);
    delete cacheRef.current[id];
  }, []);

  useEffect(() => () => {
    Object.keys(cacheRef.current).forEach(revokeUrl);
  }, [revokeUrl]);

  const fetchAndCache = useCallback(async (videoId: string): Promise<string> => {
    const blob = await fetchVideoContent({ videoId });
    const objectUrl = URL.createObjectURL(blob);
    const existing = cacheRef.current[videoId];
    if (existing) URL.revokeObjectURL(existing);
    cacheRef.current[videoId] = objectUrl;
    return objectUrl;
  }, []);

  const ensureCached = useCallback(async (videoId: string): Promise<string | null> => {
    if (!videoId) return null;
    if (cacheRef.current[videoId]) return cacheRef.current[videoId];

    const existingPromise = inFlightRef.current[videoId];
    if (existingPromise) {
      try {
        const result = await existingPromise;
        return result;
      } catch {
        return null;
      }
    }

    const promise = fetchAndCache(videoId)
      .then((url) => url)
      .catch((error) => {
        revokeUrl(videoId);
        throw error;
      })
      .finally(() => {
        delete inFlightRef.current[videoId];
      });

    inFlightRef.current[videoId] = promise;

    try {
      const result = await promise;
      return result;
    } catch {
      return null;
    }
  }, [fetchAndCache, revokeUrl]);

  const prefetchPreviews = useCallback(async (videoIds: string[]): Promise<void> => {
    const uniqueIds = Array.from(new Set((videoIds || []).filter(Boolean)));
    const validSet = new Set(uniqueIds);

    Object.keys(cacheRef.current).forEach((cachedId) => {
      if (!validSet.has(cachedId)) {
        revokeUrl(cachedId);
      }
    });

    Object.keys(inFlightRef.current).forEach((pendingId) => {
      if (!validSet.has(pendingId)) {
        delete inFlightRef.current[pendingId];
      }
    });

    if (uniqueIds.length === 0) {
      return;
    }

    await Promise.allSettled(uniqueIds.map((id) => ensureCached(id)));
  }, [ensureCached, revokeUrl]);

  const playPreview = useCallback(async (videoId: string) => {
    if (!videoId) return;
    if (previewingId === videoId && previewUrl) return;

    if (cacheRef.current[videoId]) {
      setPreviewUrl(cacheRef.current[videoId]);
      setPreviewingId(videoId);
      return;
    }

    setLoading(true);
    try {
      const cachedUrl = await ensureCached(videoId);
      if (cachedUrl) {
        setPreviewUrl(cachedUrl);
        setPreviewingId(videoId);
      }
    } finally {
      setLoading(false);
    }
  }, [ensureCached, previewUrl, previewingId]);

  return {
    previewUrl,
    previewingId,
    previewLoading: loading,
    playPreview,
    clearPreview,
    prefetchPreviews,
  };
};

export default usePreview;
