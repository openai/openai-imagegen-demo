"use client";

import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCcw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PHOTOBOOTH_STYLES } from "@/lib/photobooth-styles";
import { cn } from "@/lib/utils";
import {
  streamPhotoboothStyles,
  type PhotoboothStreamEventName,
} from "@/services/soraApi";

type StoredRequest = {
  imageDataUrl: string;
  styleIds: string[];
  source?: "camera" | "upload";
  createdAt?: string;
};

type ResultStatus = "queued" | "streaming" | "done" | "error";

type ResultCard = {
  styleId: string;
  label: string;
  description: string;
  status: ResultStatus;
  partialImageUrl: string | null;
  finalImageUrl: string | null;
  partialIndex: number | null;
  error: string | null;
};

type ModalState = {
  label: string;
  imageUrl: string;
  styleId: string;
} | null;

const STORAGE_KEY = "photobooth.request";

function makeInitialCards(styleIds: string[]): ResultCard[] {
  return styleIds.map((styleId) => {
    const style = PHOTOBOOTH_STYLES.find((entry) => entry.id === styleId);
    return {
      styleId,
      label: style?.label ?? styleId,
      description: style?.description ?? "Custom style",
      status: "queued",
      partialImageUrl: null,
      finalImageUrl: null,
      partialIndex: null,
      error: null,
    };
  });
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function ResultsPage() {
  const router = useRouter();
  const [requestData, setRequestData] = useState<StoredRequest | null>(null);
  const [cards, setCards] = useState<ResultCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [modalState, setModalState] = useState<ModalState>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setError("No photo session found. Start from the home page.");
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredRequest;
      if (
        !parsed ||
        typeof parsed.imageDataUrl !== "string" ||
        !Array.isArray(parsed.styleIds) ||
        !parsed.styleIds.length
      ) {
        throw new Error("Invalid stored session.");
      }
      setRequestData(parsed);
      setCards(makeInitialCards(parsed.styleIds));
    } catch {
      setError("Saved session is invalid. Please start again.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!requestData) return;

    const controller = new AbortController();
    setCards(makeInitialCards(requestData.styleIds));
    setError("");
    setLoading(true);

    const applyEvent = (
      eventName: PhotoboothStreamEventName,
      payload: Record<string, unknown>
    ) => {
      const styleId = typeof payload.styleId === "string" ? payload.styleId : null;
      if (eventName === "session-error") {
        const message =
          typeof payload.message === "string"
            ? payload.message
            : "Streaming failed unexpectedly.";
        setError(message);
        return;
      }

      if (!styleId) return;

      setCards((previous) =>
        previous.map((card) => {
          if (card.styleId !== styleId) return card;

          if (eventName === "style-start") {
            return {
              ...card,
              status: "streaming",
              error: null,
            };
          }

          if (eventName === "style-partial") {
            const imageDataUrl =
              typeof payload.imageDataUrl === "string"
                ? payload.imageDataUrl
                : card.partialImageUrl;
            return {
              ...card,
              status: "streaming",
              partialImageUrl: imageDataUrl,
              partialIndex:
                typeof payload.partialIndex === "number"
                  ? payload.partialIndex
                  : card.partialIndex,
            };
          }

          if (eventName === "style-final") {
            const imageDataUrl =
              typeof payload.imageDataUrl === "string"
                ? payload.imageDataUrl
                : card.finalImageUrl;
            return {
              ...card,
              status: "done",
              finalImageUrl: imageDataUrl,
              partialImageUrl: imageDataUrl,
              error: null,
            };
          }

          if (eventName === "style-error") {
            return {
              ...card,
              status: "error",
              error:
                typeof payload.message === "string"
                  ? payload.message
                  : "Style generation failed.",
            };
          }

          return card;
        })
      );
    };

    streamPhotoboothStyles({
      imageDataUrl: requestData.imageDataUrl,
      styleIds: requestData.styleIds,
      signal: controller.signal,
      onEvent: applyEvent,
    })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        const message =
          cause instanceof Error && cause.message
            ? cause.message
            : "Failed to generate styles.";
        setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [requestData]);

  const completedImages = useMemo(
    () =>
      cards
        .map((card) => ({
          styleId: card.styleId,
          label: card.label,
          imageUrl: card.finalImageUrl ?? card.partialImageUrl,
        }))
        .filter(
          (item): item is { styleId: string; label: string; imageUrl: string } =>
            typeof item.imageUrl === "string" && Boolean(item.imageUrl)
        ),
    [cards]
  );

  const hasAnyImage = completedImages.length > 0;

  const downloadAll = useCallback(() => {
    completedImages.forEach((image) => {
      downloadUrl(image.imageUrl, `${image.styleId}-portrait.png`);
    });
  }, [completedImages]);

  return (
    <main className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.15),transparent_50%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 md:px-8 md:py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-12 rounded-full"
              onClick={() => router.push("/")}
              aria-label="Back"
            >
              <ArrowLeft className="size-7" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-12 rounded-full"
              onClick={() => {
                sessionStorage.removeItem(STORAGE_KEY);
                router.push("/");
              }}
              aria-label="Restart generation"
            >
              <RefreshCcw className="size-7" />
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Results
            </h1>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="size-12 rounded-full"
            aria-label="Download generated images"
            onClick={downloadAll}
            disabled={!hasAnyImage}
          >
            <Download className="size-7" />
          </Button>
        </header>

        {requestData ? (
          <section className="mt-5">
            <img
              src={requestData.imageDataUrl}
              alt="Source"
              className="h-[24svh] w-full rounded-2xl object-cover md:h-[30svh]"
            />
          </section>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const activeImage = card.finalImageUrl ?? card.partialImageUrl;
            const isStreaming = card.status === "streaming";
            const isDone = card.status === "done";
            const statusLabel =
              card.status === "queued"
                ? "Queued"
                : card.status === "streaming"
                  ? card.partialIndex !== null
                    ? `Streaming ${card.partialIndex + 1}`
                    : "Streaming"
                  : card.status === "done"
                    ? "Done"
                    : "Error";

            return (
              <article
                key={card.styleId}
                className="group overflow-hidden rounded-2xl border bg-card/90 shadow-sm"
              >
                <button
                  type="button"
                  className={cn(
                    "block w-full text-left",
                    activeImage ? "cursor-zoom-in" : "cursor-default"
                  )}
                  onClick={() => {
                    if (!activeImage) return;
                    setModalState({
                      label: card.label,
                      imageUrl: activeImage,
                      styleId: card.styleId,
                    });
                  }}
                >
                  <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                    {activeImage ? (
                      <img
                        src={activeImage}
                        alt={`${card.label} result`}
                        className={cn(
                          "h-full w-full object-cover transition-transform duration-500",
                          activeImage ? "group-hover:scale-[1.02]" : ""
                        )}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        {loading ? (
                          <Loader2 className="animate-spin text-muted-foreground" />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Waiting for output
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-3 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{card.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {card.description}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                        isDone
                          ? "bg-primary/15 text-primary"
                          : isStreaming
                            ? "bg-sky-100 text-sky-700"
                            : card.status === "error"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-muted text-muted-foreground"
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </button>

                <div className="flex items-center justify-between px-3 pb-3">
                  <p className="text-xs text-muted-foreground">
                    {card.error ?? (isDone ? "Final image ready" : "Generating...")}
                  </p>
                  {activeImage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        downloadUrl(activeImage, `${card.styleId}-portrait.png`);
                      }}
                    >
                      <Download data-icon="inline-start" />
                      Download
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        <div className="mt-auto flex justify-end pb-2 pt-6">
          <Button size="sm" variant="outline" onClick={() => router.push("/")}>
            Create another set
          </Button>
        </div>
      </div>

      {modalState ? (
        <div
          className="fixed inset-0 z-50 bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label={`${modalState.label} preview`}
          onClick={() => setModalState(null)}
        >
          <div
            className="relative flex h-full w-full flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 md:px-8">
              <p className="text-sm font-medium text-white md:text-base">
                {modalState.label}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    downloadUrl(
                      modalState.imageUrl,
                      `${modalState.styleId}-portrait.png`
                    )
                  }
                >
                  <Download data-icon="inline-start" />
                  Download
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setModalState(null)}
                  aria-label="Close preview"
                >
                  <X />
                </Button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center p-4 md:p-8">
              <img
                src={modalState.imageUrl}
                alt={`${modalState.label} full preview`}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
