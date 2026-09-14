import { useEffect, useState } from "react";
import { findPhotoboothStyle, type PhotoboothStyleId } from "@/lib/photobooth-styles";
import { buildInitialResultCards } from "@/lib/photobooth-results";
import { loadPhotoboothRequest } from "@/lib/photobooth-session";
import type { PhotoboothRequestPayload, ResultCard } from "@/types/photobooth";
import {
  streamImagegenStyles,
  type ImagegenStreamEventName,
} from "@/services/imagegen-api";

const resolveStyleId = (value: unknown): PhotoboothStyleId | null => {
  if (typeof value !== "string") return null;
  return findPhotoboothStyle(value)?.id ?? null;
};

export const usePhotoboothResults = () => {
  const [requestData, setRequestData] = useState<PhotoboothRequestPayload | null>(null);
  const [cards, setCards] = useState<ResultCard[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const retryFailedStyles = () => {
    if (loading || !requestData) return;
    const styleIds = cards
      .filter((card) => card.status === "error")
      .map((card) => card.styleId);
    if (!styleIds.length) return;
    setLoading(true);
    setRequestData({ ...requestData, styleIds });
  };

  useEffect(() => {
    const request = loadPhotoboothRequest();
    if (!request) {
      setError("No valid photo session found. Start from the home page.");
      setLoading(false);
      return;
    }

    setRequestData(request);
    setCards(buildInitialResultCards(request.styleIds));
  }, []);

  useEffect(() => {
    if (!requestData) return;

    const controller = new AbortController();
    let failureMessage = "No final image received. Retry the failed styles.";
    setCards((previousCards) => {
      const freshCards = buildInitialResultCards(requestData.styleIds);
      return previousCards.length
        ? previousCards.map((card) =>
            freshCards.find((fresh) => fresh.styleId === card.styleId) ?? card,
          )
        : freshCards;
    });
    setError("");
    setLoading(true);

    const applyEvent = (
      eventName: ImagegenStreamEventName,
      payload: Record<string, unknown>,
    ) => {
      if (controller.signal.aborted) return;
      if (eventName === "session-error") {
        const message =
          typeof payload.message === "string"
            ? payload.message
            : "Streaming failed unexpectedly.";
        setError(message);
        return;
      }

      const styleId = resolveStyleId(payload.styleId);
      if (!styleId) return;

      setCards((previousCards) =>
        previousCards.map((card) => {
          if (card.styleId !== styleId || card.status === "done") return card;

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
              partialImageUrl: null,
              error:
                typeof payload.message === "string"
                  ? payload.message
                  : "Style generation failed.",
            };
          }

          return card;
        }),
      );
    };

    streamImagegenStyles({
      model: requestData.model,
      imageDataUrl: requestData.imageDataUrl,
      styleIds: requestData.styleIds,
      signal: controller.signal,
      onEvent: applyEvent,
    })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : "";
        failureMessage =
          /network\s*error|failed to fetch|load failed|network request failed/i.test(message)
            ? "Connection lost while generating images. Check that the app is running, then retry the failed styles."
            : message || "Failed to generate styles. Retry the failed styles.";
        setError(failureMessage);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCards((previousCards) => previousCards.map((card) =>
            card.status === "queued" || card.status === "streaming"
              ? { ...card, status: "error", partialImageUrl: null, error: failureMessage }
              : card,
          ));
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [requestData]);

  return {
    cards,
    error,
    loading,
    retryFailedStyles,
    model: requestData?.model ?? null,
  };
};
