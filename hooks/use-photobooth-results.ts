import { useEffect, useState } from "react";
import { findPhotoboothStyle, type PhotoboothStyleId } from "@/lib/photobooth-styles";
import { buildInitialResultCards } from "@/lib/photobooth-results";
import { consumePhotoboothRequest } from "@/lib/photobooth-session";
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

  useEffect(() => {
    const request = consumePhotoboothRequest();
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
    setCards(buildInitialResultCards(requestData.styleIds));
    setError("");
    setLoading(true);

    const applyEvent = (
      eventName: ImagegenStreamEventName,
      payload: Record<string, unknown>,
    ) => {
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

  return {
    cards,
    error,
    loading,
  };
};
