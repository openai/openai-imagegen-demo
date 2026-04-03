type VideoModel = "sora-2" | "sora-2-pro";
type VideoSeconds = "4" | "8" | "12";
type VideoSize = "720x1280" | "1280x720" | "1024x1792" | "1792x1024";

type UnknownRecord = Record<string, unknown>;

const MODEL_FALLBACK: VideoModel = "sora-2";
const SIZE_FALLBACK: VideoSize = "1280x720";
const SECONDS_FALLBACK: VideoSeconds = "4";

const ALLOWED_MODELS = new Set<VideoModel>(["sora-2", "sora-2-pro"]);
const ALLOWED_SIZES = new Set<VideoSize>(["720x1280", "1280x720", "1024x1792", "1792x1024"]);
const ALLOWED_SECONDS = new Set<VideoSeconds>(["4", "8", "12"]);

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type VideoRequestPayload = {
  prompt: string;
  model: VideoModel;
  size: VideoSize;
  seconds: VideoSeconds;
};

const coerceUnionValue = <T extends string>(
  value: string | null | undefined,
  set: Set<T>,
  fallback: T,
): T => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (set.has(trimmed as T)) {
    return trimmed as T;
  }
  return fallback;
};

export const coerceVideoModel = (value: string | null | undefined): VideoModel =>
  coerceUnionValue(value, ALLOWED_MODELS, MODEL_FALLBACK);

export const coerceVideoSize = (value: string | null | undefined): VideoSize =>
  coerceUnionValue(value, ALLOWED_SIZES, SIZE_FALLBACK);

export const coerceVideoSeconds = (value: string | null | undefined): VideoSeconds =>
  coerceUnionValue(value, ALLOWED_SECONDS, SECONDS_FALLBACK);

const toUnixSeconds = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? Math.round(value / 1000) : Math.round(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed > 1e12 ? Math.round(parsed / 1000) : Math.round(parsed);
    }
    const timestamp = Date.parse(trimmed);
    if (Number.isFinite(timestamp)) {
      return Math.round(timestamp / 1000);
    }
  }
  return null;
};

const readString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const extractDownloadUrl = (video: unknown): string | null => {
  if (!isRecord(video)) return null;

  const directDownload = readString(video.download_url) || readString(video.content_url);
  if (directDownload) {
    return directDownload;
  }

  if (isRecord(video.assets) && isRecord(video.assets.video)) {
    const nestedDownload = readString(video.assets.video.download_url);
    if (nestedDownload) {
      return nestedDownload;
    }
  }

  const searchInCollection = (collection: unknown): string | null => {
    if (!Array.isArray(collection)) return null;
    for (const entry of collection) {
      if (!isRecord(entry)) continue;
      const url = readString(entry.download_url) || readString(entry.url);
      if (url) return url;
    }
    return null;
  };

  const downloadFromAssets = searchInCollection(video.assets);
  if (downloadFromAssets) {
    return downloadFromAssets;
  }

  return searchInCollection(video.output);
};

const extractThumbnailUrl = (video: unknown): string | null => {
  if (!isRecord(video)) return null;

  const directThumbnail = readString(video.thumbnail_url);
  if (directThumbnail) {
    return directThumbnail;
  }

  if (isRecord(video.assets) && isRecord(video.assets.thumbnail)) {
    const nestedThumbnail = readString(video.assets.thumbnail.url);
    if (nestedThumbnail) {
      return nestedThumbnail;
    }
  }

  if (Array.isArray(video.assets)) {
    for (const asset of video.assets) {
      if (!isRecord(asset)) continue;
      if (readString(asset.type) === "thumbnail") {
        const url = readString(asset.url);
        if (url) return url;
      }
    }
  }

  return null;
};

export type NormalizedVideoResponse = UnknownRecord & {
  id: string;
  status: string;
  prompt: string;
  model: VideoModel;
  size: VideoSize;
  seconds: VideoSeconds;
  created_at: number;
  completed_at: number | null;
  remix_video_id: string | null;
  download_url: string | null;
  thumbnail_url: string | null;
  error: unknown;
};

const resolveVideoId = (video: UnknownRecord, now: number): string => {
  const directId = readString(video.id) || readString(video.video_id);
  if (directId) return directId;

  if (isRecord(video.data)) {
    const nestedId = readString(video.data.id);
    if (nestedId) return nestedId;
  }

  return `video_${now}`;
};

export const normalizeVideoResponse = (
  video: unknown,
  fallback: VideoRequestPayload,
): NormalizedVideoResponse => {
  const now = Math.floor(Date.now() / 1000);
  const videoData: UnknownRecord = isRecord(video) ? video : {};

  const statusRaw =
    readString(videoData.status)
    || readString(videoData.state)
    || "queued";

  const createdAt = toUnixSeconds(videoData.created_at) ?? now;
  const completedAt = toUnixSeconds(videoData.completed_at)
    ?? (statusRaw === "completed" ? now : null);

  const remixVideoId = readString(videoData.remix_video_id)
    || readString(videoData.remix_of)
    || readString(videoData.remixed_from_video_id)
    || null;

  const response: NormalizedVideoResponse = {
    ...videoData,
    id: resolveVideoId(videoData, now),
    status: statusRaw,
    prompt: fallback.prompt,
    model: fallback.model,
    size: fallback.size,
    seconds: fallback.seconds,
    created_at: createdAt,
    completed_at: completedAt,
    remix_video_id: remixVideoId,
    download_url: extractDownloadUrl(videoData),
    thumbnail_url: extractThumbnailUrl(videoData),
    error: "error" in videoData ? videoData.error ?? null : null,
  };

  return response;
};

export const describeError = (error: unknown, fallbackMessage: string) => {
  if (error && typeof error === "object") {
    const anyError = error as { message?: string };
    if (typeof anyError.message === "string" && anyError.message.trim()) {
      return anyError.message;
    }
  }
  return fallbackMessage;
};

export const resolveErrorStatus = (error: unknown, fallbackStatus = 500) => {
  if (isRecord(error) && typeof error.status === "number") {
    return error.status;
  }

  if (typeof error === "object" && error !== null && "status" in error) {
    const statusValue = (error as { status?: unknown }).status;
    if (typeof statusValue === "number") {
      return statusValue;
    }
  }

  return fallbackStatus;
};
