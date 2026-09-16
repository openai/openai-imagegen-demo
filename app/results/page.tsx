"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResultImageCard } from "@/components/photobooth/result-image-card";
import { ResultPreviewModal } from "@/components/photobooth/result-preview-modal";
import { usePhotoboothResults } from "@/hooks/use-photobooth-results";
import { downloadUrl } from "@/lib/browser/file-utils";
import { clearPhotoboothRequest } from "@/lib/photobooth-session";
import type { ResultCard, ResultPreviewState } from "@/types/photobooth";
import { IMAGE_MODELS } from "@/lib/image-models";

export default function ResultsPage() {
  const router = useRouter();
  const { cards, error, loading, model, retryFailedStyles } = usePhotoboothResults();
  const [modalState, setModalState] = useState<ResultPreviewState>(null);
  const showCenteredErrorState = Boolean(error) && cards.length === 0;

  const handleOpenPreview = (card: ResultCard) => {
    const imageUrl =
      card.finalImageUrl ??
      (card.status === "streaming" ? card.partialImageUrl : null);
    if (!imageUrl) return;

    setModalState({
      label: card.label,
      imageUrl,
      styleId: card.styleId,
    });
  };

  const handleDownloadResult = (card: ResultCard) => {
    if (card.status !== "done" || !card.finalImageUrl) return;

    downloadUrl(card.finalImageUrl, `${card.styleId}-portrait.png`);
  };

  const canDownloadPreview =
    modalState !== null &&
    cards.some(
      (card) =>
        card.styleId === modalState.styleId &&
        card.status === "done" &&
        Boolean(card.finalImageUrl),
    );

  const previewDownloadUrl =
    modalState === null
      ? null
      : cards.find((card) => card.styleId === modalState.styleId)?.finalImageUrl;

  return (
    <main className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.15),transparent_50%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1700px] flex-col p-4 md:p-8">
        {model ? (
          <p className="text-center text-sm text-muted-foreground">
            {IMAGE_MODELS.find((option) => option.id === model)?.label}
          </p>
        ) : null}
        {showCenteredErrorState ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <>
            {error ? (
              <p role="alert" className="mb-2 w-full text-center text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {cards.length ? (
              <section className="mt-3 flex flex-wrap justify-center gap-3 md:mt-4 md:gap-4">
                {cards.map((card) => (
                  <div
                    key={card.styleId}
                    className="w-[calc(50%-0.375rem)] md:w-[calc(25%-0.75rem)]"
                  >
                    <ResultImageCard
                      card={card}
                      onDownload={handleDownloadResult}
                      onOpenPreview={handleOpenPreview}
                    />
                  </div>
                ))}
              </section>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                {loading ? "Loading results..." : "Nothing here yet."}
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap justify-center gap-3 pb-3 pt-6 md:pt-8">
          {!loading && cards.some((card) => card.status === "error") ? (
            <Button
              className="h-11 rounded-xl px-5 text-base"
              onClick={retryFailedStyles}
            >
              Retry failed styles
            </Button>
          ) : null}
          <Button
            className="h-11 rounded-xl bg-black px-5 text-base text-white hover:bg-black/90"
            onClick={() => {
              clearPhotoboothRequest();
              router.push("/");
            }}
          >
            Create another set
          </Button>
        </div>
      </div>

      <ResultPreviewModal
        canDownload={canDownloadPreview}
        modalState={modalState}
        onClose={() => setModalState(null)}
        onDownload={() => {
          if (!modalState || !canDownloadPreview || !previewDownloadUrl) return;
          downloadUrl(previewDownloadUrl, `${modalState.styleId}-portrait.png`);
        }}
      />
    </main>
  );
}
