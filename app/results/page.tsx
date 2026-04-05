"use client";

import {
  Download,
  Loader2,
  RefreshCcw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PHOTOBOOTH_STYLES } from "@/lib/photobooth-styles";
import { cn } from "@/lib/utils";
import {
  streamImagegenStyles,
  type ImagegenStreamEventName,
} from "@/services/imagegenApi";

type StoredRequest = {
  imageDataUrl: string;
  styleIds: string[];
};

type ResultStatus = "queued" | "streaming" | "done" | "error";

type ResultCard = {
  styleId: string;
  label: string;
  status: ResultStatus;
  partialImageUrl: string | null;
  finalImageUrl: string | null;
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
      status: "queued",
      partialImageUrl: null,
      finalImageUrl: null,
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
      eventName: ImagegenStreamEventName,
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

    streamImagegenStyles({
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

  return (
    <main className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.15),transparent_50%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 md:px-8 md:py-8">
        <header className="flex items-center justify-end">
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
        </header>

        {requestData ? (
          <section className="mt-4">
            <p className="mb-2 text-sm font-medium">Original Image</p>
            <div className="w-36 overflow-hidden rounded-xl border bg-card/90 sm:w-44 md:w-52 lg:w-56">
              <img
                src={requestData.imageDataUrl}
                alt="Source"
                className="aspect-[2/3] w-full object-cover"
              />
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const activeImage = card.finalImageUrl ?? card.partialImageUrl;
            const showSpinner =
              card.status === "queued" || card.status === "streaming";

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
                        {showSpinner ? (
                          <Loader2 className="animate-spin text-muted-foreground" />
                        ) : card.status === "error" ? (
                          <span className="px-3 text-center text-sm text-destructive">
                            {card.error ?? "Generation failed"}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Waiting for output
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>

                <div className="flex items-center justify-between px-3 py-3">
                  <p className="text-base font-medium">{card.label}</p>
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
            className="absolute inset-x-4 top-4 z-10 flex items-center justify-between md:inset-x-8"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md md:text-base">
              {modalState.label}
            </p>
            <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 p-1.5 backdrop-blur-md">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full px-3 text-white hover:bg-white/15 hover:text-white"
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
                variant="ghost"
                size="icon"
                className="size-9 rounded-full text-white hover:bg-white/15 hover:text-white"
                onClick={() => setModalState(null)}
                aria-label="Close preview"
              >
                <X />
              </Button>
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-center p-4 pt-20 md:p-10 md:pt-24">
            <div
              className="flex max-h-full max-w-full items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={modalState.imageUrl}
                alt={`${modalState.label} full preview`}
                className="max-h-[calc(100svh-8rem)] max-w-[calc(100vw-2rem)] rounded-xl object-contain shadow-2xl md:max-h-[calc(100svh-10rem)] md:max-w-[calc(100vw-5rem)]"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
