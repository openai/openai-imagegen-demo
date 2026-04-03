type UnixLike = number | string | Date | null | undefined;

const toDate = (value: UnixLike): Date | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const ms = numeric > 1e12 ? numeric : numeric * 1000;
      const numericDate = new Date(ms);
      if (!Number.isNaN(numericDate.getTime())) return numericDate;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

export const formatDateTime = (value: UnixLike): string => {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDurationMinutes = (start: UnixLike, end: UnixLike): string => {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return "";
  const diffSec = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
  if (diffSec <= 0) return "";
  const minutes = Math.max(1, Math.round(diffSec / 60));
  return `${minutes} min`;
};

export const formatProgressPercent = (value: unknown): string | null => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  const clamped = Math.min(100, Math.max(0, num));
  return Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(1);
};
