export const DEFAULT_SIZE = "1280x720" as const;

export const MODEL_OPTIONS = ["sora-2", "sora-2-pro"] as const;
export type SoraModel = (typeof MODEL_OPTIONS)[number];

export type SizeOptionGroups = {
  portrait: readonly string[];
  landscape: readonly string[];
};

export const MODEL_SIZE_OPTIONS: Record<SoraModel, SizeOptionGroups> = {
  "sora-2": {
    portrait: ["720x1280"],
    landscape: [DEFAULT_SIZE],
  },
  "sora-2-pro": {
    portrait: ["720x1280", "1024x1792"],
    landscape: [DEFAULT_SIZE, "1792x1024"],
  },
};

export const SECONDS_OPTIONS = ["4", "8", "12"] as const;
export type SoraSeconds = (typeof SECONDS_OPTIONS)[number];

export const sanitizeSeconds = (value: string | number | null | undefined): SoraSeconds => {
  const str = typeof value === "number" ? String(value) : (value ?? "").trim();
  return SECONDS_OPTIONS.includes(str as SoraSeconds) ? (str as SoraSeconds) : SECONDS_OPTIONS[0];
};

export const IMAGE_INPUT_ALERT = "This video used an image input. Please select the correct image manually before generating.";

export type VideoStatus = "queued" | "in_progress" | "completed" | "succeeded" | "failed" | string;

export interface VideoItem extends Record<string, unknown> {
  id: string;
  status: VideoStatus;
  title: string;
  prompt?: string | null;
  model: SoraModel;
  size: string;
  seconds: SoraSeconds;
  remix_video_id: string | null;
  createdAt: string | null;
  completedAt: string | null;
  download_url?: string | null;
  thumbnail_url?: string | null;
  progress?: number | string | null;
  downloaded: boolean;
  image_input_required: boolean;
  error: unknown;
}

const coerceProgressPercent = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, normalized));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/%+$/, ""));
    if (!Number.isFinite(numeric)) return null;
    const normalized = numeric <= 1 ? numeric * 100 : numeric;
    return Math.max(0, Math.min(100, normalized));
  }
  return null;
};

export const sanitizeModel = (value: string): SoraModel => (
  MODEL_OPTIONS.includes(value as SoraModel) ? (value as SoraModel) : MODEL_OPTIONS[0]
);

export const getModelSizeOptions = (modelKey: string): SizeOptionGroups => {
  const key = sanitizeModel(modelKey);
  return MODEL_SIZE_OPTIONS[key] ?? MODEL_SIZE_OPTIONS[MODEL_OPTIONS[0]];
};

export const sanitizeSizeForModel = (sizeValue: string, modelKey: string): string => {
  const { portrait, landscape } = getModelSizeOptions(modelKey);
  const allowed = [...portrait, ...landscape];
  if (allowed.includes(sizeValue)) return sizeValue;
  return landscape[0] ?? portrait[0] ?? DEFAULT_SIZE;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type TimestampLike = string | number | Date | null | undefined;

type NullableNumber = number | null;

type WithTimestamp = Partial<Pick<VideoItem, "completed_at" | "completedAt" | "created_at" | "createdAt">> & Record<string, unknown>;

const toTimestampLike = (value: unknown): TimestampLike => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (value instanceof Date) return value;
  return null;
};

export const getCompletedTimestampMs = (item: WithTimestamp | null | undefined): NullableNumber => {
  if (!item) return null;
  const raw = item.completed_at ?? item.completedAt ?? null;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return raw > 1e12 ? raw : raw * 1000;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? ms : null;
  }
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    return raw.getTime();
  }
  return null;
};

export const isWithinLast24Hours = (item: WithTimestamp | null | undefined): boolean => {
  const ms = getCompletedTimestampMs(item);
  if (ms === null) return false;
  return (Date.now() - ms) <= ONE_DAY_MS;
};

export const isCompletedStatus = (status: VideoStatus | null | undefined): boolean =>
  status === "completed" || status === "succeeded";

export const isFailedStatus = (status: VideoStatus | null | undefined): boolean => status === "failed";

const normalizeTimestamp = (value: TimestampLike): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    const date = new Date(value * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
};

export interface SizeDimensions {
  width: number;
  height: number;
}

export const parseSize = (sizeStr: string): SizeDimensions => {
  if (typeof sizeStr !== "string") return { width: 1280, height: 720 };
  const [wRaw, hRaw] = sizeStr.split("x");
  const w = Number(wRaw);
  const h = Number(hRaw);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: 1280, height: 720 };
  }
  return { width: w, height: h };
};

type PartialVideoItem = Partial<VideoItem> & Record<string, unknown>;

export const normalizeVideo = (
  raw: PartialVideoItem | null | undefined,
  fallback: PartialVideoItem = {},
): VideoItem => {
  const source = (raw ?? {}) as PartialVideoItem;
  const fallbackSource = (fallback ?? {}) as PartialVideoItem;

  const completedAt = normalizeTimestamp(
    toTimestampLike(source.completed_at ?? source.completedAt)
  )
    || normalizeTimestamp(
      toTimestampLike(fallbackSource.completed_at ?? fallbackSource.completedAt)
    )
    || null;
  const createdAt = normalizeTimestamp(
    toTimestampLike(source.created_at ?? source.createdAt)
  )
    || normalizeTimestamp(
      toTimestampLike(fallbackSource.created_at ?? fallbackSource.createdAt)
    )
    || null;
  const status = (source.status ?? fallbackSource.status ?? "unknown") as VideoStatus;
  const title = (source.title || fallbackSource.title || source.name || "").toString().trim();
  const promptSource = (source.prompt ?? fallbackSource.prompt) as string | null | undefined;
  const prompt = typeof promptSource === "string" && promptSource.trim()
    ? promptSource.trim()
    : typeof fallbackSource.prompt === "string"
      ? fallbackSource.prompt
      : "";
  const model = sanitizeModel((source.model ?? fallbackSource.model ?? MODEL_OPTIONS[0]) as string);
  const size = sanitizeSizeForModel((source.size ?? fallbackSource.size ?? DEFAULT_SIZE) as string, model);
  const seconds = sanitizeSeconds(source.seconds ?? fallbackSource.seconds ?? SECONDS_OPTIONS[0]);
  const remix_video_id = (source.remix_video_id
    ?? source.remixVideoId
    ?? source.remix_of
    ?? source.remixOf
    ?? source.source_video_id
    ?? source.sourceVideoId
    ?? fallbackSource.remix_video_id
    ?? null) as string | null;
  const image_input_required = Boolean(source.image_input_required ?? fallbackSource.image_input_required ?? false);
  const downloaded = Boolean(source.downloaded ?? fallbackSource.downloaded ?? false);
  const error = source.error ?? fallbackSource.error ?? null;
  const download_url = typeof source.download_url === "string"
    ? source.download_url
    : typeof fallbackSource.download_url === "string"
      ? fallbackSource.download_url
      : null;
  let progress = coerceProgressPercent(source.progress ?? fallbackSource.progress ?? null);

  let finalCompletedAt = completedAt;
  if (!finalCompletedAt && isCompletedStatus(status)) {
    finalCompletedAt = fallbackSource.completedAt ?? new Date().toISOString();
  }

  let finalStatus = status;
  if (!isCompletedStatus(finalStatus)) {
    if (progress !== null && progress >= 100) {
      finalStatus = "completed";
    } else if (download_url) {
      finalStatus = "completed";
    }
  }

  if (!finalCompletedAt && isCompletedStatus(finalStatus)) {
    finalCompletedAt = new Date().toISOString();
  }

  if (isCompletedStatus(finalStatus) && (progress === null || progress < 100)) {
    progress = 100;
  }

  return {
    ...fallbackSource,
    ...source,
    id: String(source.id ?? fallbackSource.id ?? ""),
    status: finalStatus,
    title,
    prompt,
    model,
    size,
    seconds,
    remix_video_id,
    createdAt,
    completedAt: finalCompletedAt,
    progress,
    download_url,
    downloaded,
    image_input_required,
    error,
  } satisfies VideoItem;
};

export const ensurePrompt = (
  item: Pick<VideoItem, "prompt" | "title"> | null | undefined,
  currentPrompt = "",
): string => {
  if (item?.prompt && item.prompt.trim()) return item.prompt;
  if (currentPrompt && currentPrompt.trim()) return currentPrompt;
  if (item?.title && item.title.trim()) return item.title.trim();
  return "Regenerate previous Sora video";
};

export const buildDownloadName = (id: string, title: string | null | undefined): string => {
  const safe = (title || "")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return `${id}.mp4`;
  const normalized = safe
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("-");
  return `${normalized.slice(0, 60) || id}.mp4`;
};
