"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Loader2, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoForm, {
  type BatchProgressState,
  type GeneratedImageSuggestion,
} from "@/components/VideoForm";
import VideoSidebar, {
  type SidebarPreviewState,
} from "@/components/VideoSidebar";
import VideoPreviewOverlay from "@/components/VideoPreviewOverlay";
import usePersistedState from "@/hooks/usePersistedState";
import usePreview from "@/hooks/usePreview";
import useThumbnails from "@/hooks/useThumbnails";
import useVideoForm from "@/hooks/useVideoForm";
import useVideoPolling from "@/hooks/useVideoPolling";
import {
  IMAGE_INPUT_ALERT,
  MODEL_OPTIONS,
  buildDownloadName,
  ensurePrompt,
  isCompletedStatus,
  normalizeVideo,
  parseSize,
  sanitizeModel,
  sanitizeSizeForModel,
  type VideoItem,
  type SoraModel,
  type SoraSeconds,
} from "@/utils/video";
import { extractTitleFromResponse } from "@/utils/titles";
import {
  createVideo,
  fetchVideo,
  fetchVideoContent,
  generateImages,
  remixVideo,
  requestVideoTitle,
  suggestVideoPrompt,
} from "@/services/soraApi";

type CreateVideoOverrideOptions = {
  overridePrompt?: string;
  overrideModel?: SoraModel;
  overrideSize?: string;
  overrideSeconds?: SoraSeconds;
  overrideRemixId?: string | null;
  overrideTitle?: string;
  replaceId?: string;
};

type DownloadResult = boolean;

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const IMAGE_GENERATION_MODEL = "gpt-image-1";

const usePreviewState = () => {
  const preview = usePreview();
  const previewState: SidebarPreviewState = {
    previewingId: preview.previewingId,
    previewLoading: preview.previewLoading,
  };
  return { preview, previewState };
};

export default function App() {
  const [items, setItems] = usePersistedState<VideoItem[]>("sora.items", []);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState | null>(
    null
  );
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [generatingTitle, setGeneratingTitle] = useState<boolean>(false);
  const [downloadingAll, setDownloadingAll] = useState<boolean>(false);
  const [generatingImages, setGeneratingImages] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<
    GeneratedImageSuggestion[]
  >([]);
  const [generatedImageError, setGeneratedImageError] = useState<string>("");
  const [selectedGeneratedImageId, setSelectedGeneratedImageId] = useState<
    string | null
  >(null);
  const [generatingPrompt, setGeneratingPrompt] = useState<boolean>(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [refreshingVideos, setRefreshingVideos] = useState<
    Record<string, boolean>
  >({});

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const openMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const {
    prompt,
    setPrompt,
    model,
    setModel,
    size,
    setSize,
    seconds,
    setSeconds,
    versionsCount,
    setVersionsCount,
    remixId,
    setRemixId,
    imageFile,
    imagePreviewUrl,
    imagePreviewMeta,
    handleImageSelect,
    handleGeneratedImageDataUrl,
    handleGeneratedImageUrl,
    clearForm: resetFormFields,
    applyVideoToForm,
    sizeOptionGroups,
  } = useVideoForm();

  const { preview, previewState } = usePreviewState();
  const { prefetchPreviews } = preview;

  const thumbnails = useThumbnails({ items });
  const previewableItems = useMemo(
    () => items.filter((item) => item?.id && isCompletedStatus(item.status)),
    [items]
  );

  useEffect(() => {
    const ids = previewableItems
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));
    prefetchPreviews(ids).catch((error) => {
      console.error("Preview prefetch failed", error);
    });
  }, [prefetchPreviews, previewableItems]);

  const currentPreviewIndex = useMemo(
    () =>
      previewableItems.findIndex((item) => item.id === preview.previewingId),
    [previewableItems, preview.previewingId]
  );
  const currentPreviewItem =
    currentPreviewIndex >= 0 ? previewableItems[currentPreviewIndex] : null;
  const hasPrevPreview = currentPreviewIndex > 0;
  const hasNextPreview =
    currentPreviewIndex >= 0 &&
    currentPreviewIndex < previewableItems.length - 1;
  const showPreviewSpinner = preview.previewLoading && !preview.previewingId;
  const derivedPromptForImages = useMemo(() => prompt.trim(), [prompt]);
  const imageGenerationSize = useMemo(() => {
    const { width, height } = parseSize(size);
    return height > width ? "1024x1536" : "1536x1024";
  }, [size]);
  const handleUpdateItem = useCallback(
    (id: string, updater: (existing: VideoItem) => VideoItem) => {
      setItems((prev) =>
        prev.map((existing) =>
          existing.id === id ? updater(existing) : existing
        )
      );
    },
    [setItems]
  );

  const handleRefreshVideo = useCallback(
    async (item: VideoItem) => {
      if (!item?.id) return;
      if (refreshingVideos[item.id]) return;
      setRefreshingVideos((prev) => ({ ...prev, [item.id]: true }));
      try {
        const payload = await fetchVideo<Record<string, unknown>>({
          videoId: item.id,
        });
        handleUpdateItem(item.id, (current) =>
          normalizeVideo(payload, current)
        );
      } catch (error) {
        console.error("Video refresh failed", error);
      } finally {
        setRefreshingVideos((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    },
    [handleUpdateItem, refreshingVideos]
  );

  useVideoPolling({ items, onUpdate: handleUpdateItem });

  const requestGeneratedTitle = useCallback(async (seedPrompt: string) => {
    try {
      const response = await requestVideoTitle<unknown>(
        seedPrompt || "Untitled"
      );
      const generated = extractTitleFromResponse(
        response as Record<string, unknown>
      );
      return generated?.trim() ? generated.trim().slice(0, 80) : "";
    } catch (error) {
      console.error("Title generation failed", error);
      return "";
    }
  }, []);

  const handleCreateVideo = useCallback(
    async (options: CreateVideoOverrideOptions = {}) => {
      const {
        overridePrompt,
        overrideModel,
        overrideSize,
        overrideSeconds,
        overrideRemixId,
        overrideTitle,
        replaceId,
      } = options;

      const effectivePromptRaw = ensurePrompt(
        { prompt: overridePrompt, title: overrideTitle || "" },
        prompt
      );
      const trimmedPrompt = effectivePromptRaw.trim();
      if (!trimmedPrompt) {
        setGeneratingTitle(false);
        setSubmitting(false);
        console.log(
          "Cannot generate without a prompt. Please provide one before retrying."
        );
        return;
      }

      setCurrentTitle("");

      const fallbackTitle =
        trimmedPrompt.split("\n")[0].slice(0, 60) || "Untitled Video";
      const effectiveModel = sanitizeModel((overrideModel ?? model) as string);
      const effectiveSize = sanitizeSizeForModel(
        overrideSize ?? size,
        effectiveModel
      );
      const effectiveSeconds = String(overrideSeconds ?? seconds);
      const effectiveRemixId = overrideRemixId ?? remixId;
      const runs = replaceId ? 1 : Math.max(1, Number(versionsCount) || 1);
      const isRemix = Boolean(effectiveRemixId);

      if (isRemix && imageFile) {
        console.log(
          "Remix currently ignores uploaded image overrides. Remove the image to continue, or create a fresh video instead."
        );
        return;
      }

      setSubmitting(true);
      setBatchProgress(null);

      let videoTitle = overrideTitle?.trim() || "";
      if (!videoTitle) {
        videoTitle = fallbackTitle;
        setGeneratingTitle(true);
        const generated = await requestGeneratedTitle(trimmedPrompt);
        if (generated) {
          videoTitle = generated;
        }
        setGeneratingTitle(false);
      }
      setCurrentTitle(videoTitle);

      try {
        for (let runIndex = 0; runIndex < runs; runIndex += 1) {
          if (runs > 1) {
            setBatchProgress({ total: runs, current: runIndex + 1 });
          }

          let payload: Record<string, unknown>;
          if (isRemix) {
            payload = await remixVideo<Record<string, unknown>>({
              videoId: effectiveRemixId as string,
              prompt: effectivePromptRaw,
              model: effectiveModel,
              size: effectiveSize,
              seconds: effectiveSeconds,
            });
          } else {
            payload = await createVideo<Record<string, unknown>>({
              prompt: effectivePromptRaw,
              model: effectiveModel,
              size: effectiveSize,
              seconds: effectiveSeconds,
              imageFile,
            });
          }

          const rawItem: Record<string, unknown> = {
            ...payload,
            prompt: effectivePromptRaw,
            model: effectiveModel,
            size: effectiveSize,
            seconds: String(effectiveSeconds),
            remix_video_id:
              effectiveRemixId ||
              payload.remix_video_id ||
              payload.remixVideoId ||
              payload.remix_of ||
              payload.source_video_id ||
              null,
            image_input_required: Boolean(imageFile),
            error: payload.error ?? null,
            createdAt: new Date().toISOString(),
            created_at:
              (payload.created_at as number | undefined) ??
              (payload.createdAt as number | undefined) ??
              Date.now() / 1000,
            retry_of: replaceId || null,
            title: videoTitle,
          };

          const normalized = normalizeVideo(rawItem);

          setItems((prev) => {
            if (replaceId && runIndex === 0) {
              let updated = false;
              const mapped = prev.map((existing) => {
                if (existing.id === replaceId) {
                  updated = true;
                  return normalizeVideo(rawItem, existing);
                }
                return existing;
              });
              return updated ? mapped : [normalized, ...prev];
            }
            return [normalized, ...prev];
          });

          if (runs > 1 && runIndex < runs - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        setRemixId("");
      } catch (error) {
        console.error(error);
        console.error(
          `Create failed: ${
            error instanceof Error ? error.message : error || "Unknown error"
          }`
        );
      } finally {
        setSubmitting(false);
        setBatchProgress(null);
      }
    },
    [
      imageFile,
      model,
      prompt,
      remixId,
      requestGeneratedTitle,
      seconds,
      setItems,
      setCurrentTitle,
      setRemixId,
      size,
      versionsCount,
    ]
  );

  const handleDownload = useCallback(
    async (item: VideoItem): Promise<DownloadResult> => {
      try {
        const blob = await fetchVideoContent({ videoId: item.id });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = buildDownloadName(item.id, item.title);
        anchor.click();
        URL.revokeObjectURL(url);
        setItems((prev) =>
          prev.map((existing) =>
            existing.id === item.id
              ? { ...existing, downloaded: true }
              : existing
          )
        );
        return true;
      } catch (error) {
        console.error(
          `Download failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      }
    },
    [setItems]
  );

  const handleDownloadAll = useCallback(async () => {
    const ready = items.filter(
      (item) => item?.id && isCompletedStatus(item.status) && !item.downloaded
    );
    if (ready.length === 0) {
      console.log("No completed videos are available for download yet.");
      return;
    }
    setDownloadingAll(true);
    try {
      for (let index = 0; index < ready.length; index += 1) {
        const entry = ready[index];
        await handleDownload(entry);
        if (index < ready.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    } finally {
      setDownloadingAll(false);
    }
  }, [handleDownload, items]);

  const handlePlayPreview = useCallback(
    async (item: VideoItem) => {
      try {
        closeMobileSidebar();
        await preview.playPreview(item.id);
      } catch (error) {
        console.error(
          `Preview failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    [closeMobileSidebar, preview]
  );

  const handlePreviewClose = useCallback(() => {
    preview.clearPreview();
  }, [preview]);

  const handlePreviewNavigate = useCallback(
    (direction: number) => {
      if (currentPreviewIndex < 0) return;
      const targetIndex = currentPreviewIndex + direction;
      if (targetIndex < 0 || targetIndex >= previewableItems.length) return;
      const targetItem = previewableItems[targetIndex];
      if (!targetItem?.id) return;
      preview.playPreview(targetItem.id).catch((error) => {
        console.error(
          `Preview failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    },
    [currentPreviewIndex, preview, previewableItems]
  );

  const handleResetForm = useCallback(() => {
    resetFormFields();
    setCurrentTitle("");
    preview.clearPreview();
    setGeneratedImages([]);
    setGeneratedImageError("");
    setSelectedGeneratedImageId(null);
  }, [preview, resetFormFields, setCurrentTitle]);

  const handleRemixFrom = useCallback(
    (item: VideoItem) => {
      if (!item?.id) return;
      const nextPrompt = ensurePrompt(item, prompt);
      applyVideoToForm(item, nextPrompt);
      setRemixId(item.id);
      setCurrentTitle(item.title || "");
      preview.clearPreview();
      scrollToTop();
      closeMobileSidebar();
    },
    [
      applyVideoToForm,
      closeMobileSidebar,
      preview,
      prompt,
      setCurrentTitle,
      setRemixId,
    ]
  );

  const handleRemove = useCallback(
    (item: VideoItem) => {
      if (!item?.id) return;
      setItems((prev) => prev.filter((existing) => existing.id !== item.id));
      if (preview.previewingId === item.id) {
        preview.clearPreview();
      }
    },
    [preview, setItems]
  );

  const handleRetry = useCallback(
    async (item: VideoItem) => {
      if (!item?.id) return;
      const nextPrompt = ensurePrompt(item, prompt);
      applyVideoToForm(item, nextPrompt);
      setRemixId(item.remix_video_id || "");
      setCurrentTitle(item.title || "");
      preview.clearPreview();
      closeMobileSidebar();
      if (item.image_input_required) {
        console.log(IMAGE_INPUT_ALERT);
        scrollToTop();
        return;
      }
      await handleCreateVideo({
        overridePrompt: nextPrompt,
        overrideModel: item.model,
        overrideSize: item.size,
        overrideSeconds: item.seconds as SoraSeconds,
        overrideRemixId: item.remix_video_id,
        overrideTitle: item.title,
        replaceId: item.id,
      });
    },
    [
      applyVideoToForm,
      closeMobileSidebar,
      preview,
      handleCreateVideo,
      prompt,
      setCurrentTitle,
      setRemixId,
    ]
  );

  const handleLocalImageSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setCurrentTitle("");
      setSelectedGeneratedImageId(null);
      if (event?.target?.files?.length) {
        setGeneratedImages([]);
        setGeneratedImageError("");
      }
      await handleImageSelect(event);
    },
    [handleImageSelect, setCurrentTitle]
  );

  const handleGenerateInputImages = useCallback(async () => {
    if (!derivedPromptForImages) {
      setGeneratedImageError(
        "Provide a prompt before generating reference images."
      );
      setGeneratedImages([]);
      setSelectedGeneratedImageId(null);
      return;
    }

    setCurrentTitle("");
    setGeneratingImages(true);
    setGeneratedImageError("");
    setGeneratedImages([]);
    setSelectedGeneratedImageId(null);

    try {
      const normalizedCount = Math.max(
        1,
        Math.min(
          4,
          Number.isFinite(versionsCount) ? Math.round(versionsCount) : 3
        )
      );

      const images = await generateImages({
        prompt: derivedPromptForImages,
        size: imageGenerationSize,
        count: normalizedCount,
        model: IMAGE_GENERATION_MODEL,
      });

      setGeneratedImages(images);
      if (images.length === 0) {
        setGeneratedImageError("No images returned. Try another prompt.");
      }
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to generate images.";
      setGeneratedImageError(message);
    } finally {
      setGeneratingImages(false);
    }
  }, [
    derivedPromptForImages,
    imageGenerationSize,
    setCurrentTitle,
    versionsCount,
  ]);

  const handleGeneratedImageSelect = useCallback(
    async (image: GeneratedImageSuggestion) => {
      if (!image?.url) return;
      setCurrentTitle("");
      setGeneratedImageError("");
      setSelectedGeneratedImageId(image.id);
      try {
        if (image.url.startsWith("data:")) {
          await handleGeneratedImageDataUrl(image.url, `${image.id}.png`);
        } else {
          await handleGeneratedImageUrl(image.url, `${image.id}.png`);
        }
      } catch (error) {
        console.error(error);
        setGeneratedImageError(
          error instanceof Error
            ? error.message
            : "Failed to apply generated image."
        );
      }
    },
    [handleGeneratedImageDataUrl, handleGeneratedImageUrl, setCurrentTitle]
  );

  const handleSuggestPrompt = useCallback(async () => {
    setCurrentTitle("");
    setGeneratingPrompt(true);
    try {
      const suggestion = await suggestVideoPrompt({
        prompt,
        seconds,
        model,
        size,
      });

      const trimmed = suggestion.trim();
      if (!trimmed) {
        console.log("Prompt suggestion unavailable. Try again.");
        return;
      }

      setPrompt(trimmed);
      setSelectedGeneratedImageId(null);
      setGeneratedImages([]);
      setGeneratedImageError("");
    } catch (error) {
      console.error("Prompt suggestion failed", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate a prompt suggestion.";
      console.log(message);
    } finally {
      setGeneratingPrompt(false);
    }
  }, [
    model,
    prompt,
    seconds,
    setCurrentTitle,
    setGeneratedImageError,
    setGeneratedImages,
    setPrompt,
    setSelectedGeneratedImageId,
    size,
  ]);

  const handlePromptChange = useCallback(
    (value: string) => {
      setCurrentTitle("");
      setPrompt(value);
    },
    [setCurrentTitle, setPrompt]
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        <VideoSidebar
          items={items}
          thumbnails={thumbnails}
          onDownloadAll={handleDownloadAll}
          downloadingAll={downloadingAll}
          onDownload={handleDownload}
          onPlayPreview={handlePlayPreview}
          onRemix={handleRemixFrom}
          onRetry={handleRetry}
          onRefresh={handleRefreshVideo}
          onRemove={handleRemove}
          refreshingMap={refreshingVideos}
          previewState={previewState}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={closeMobileSidebar}
        />
        <main className="order-2 h-screen flex-1 overflow-y-auto px-4 py-5 bg-neutral-100 dark:bg-neutral-800 lg:px-10 lg:py-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <header className="mb-1.5 flex items-start justify-between gap-3">
              <div>
                <h1 className="mb-2 text-3xl font-semibold">Sora API Demo</h1>
                <p className="text-sm text-muted-foreground">
                  Try Sora models in the API, with different parameters and text
                  + image inputs.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={openMobileSidebar}
                className="mt-1 h-10 w-10 rounded-full border-border text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
                aria-label="Open generations sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </header>
            <VideoForm
              prompt={prompt}
              onPromptChange={handlePromptChange}
              model={model}
              onModelChange={(value) => setModel(sanitizeModel(value))}
              modelOptions={MODEL_OPTIONS}
              size={size}
              onSizeChange={(value) =>
                setSize(sanitizeSizeForModel(value, model))
              }
              sizeOptionGroups={sizeOptionGroups}
              seconds={seconds}
              onSecondsChange={(value) => setSeconds(value)}
              versionsCount={versionsCount}
              onVersionsCountChange={setVersionsCount}
              remixId={remixId}
              onRemixIdChange={setRemixId}
              onImageSelect={handleLocalImageSelect}
              imagePreviewUrl={imagePreviewUrl}
              imagePreviewMeta={imagePreviewMeta}
              onGenerateImages={handleGenerateInputImages}
              generatingImages={generatingImages}
              generatedImages={generatedImages}
              onSelectGeneratedImage={handleGeneratedImageSelect}
              selectedGeneratedImageId={selectedGeneratedImageId}
              generatedImageError={generatedImageError}
              onSubmit={() => handleCreateVideo()}
              onClear={handleResetForm}
              onGeneratePrompt={handleSuggestPrompt}
              generatingPrompt={generatingPrompt}
              submitting={submitting}
              canSubmit={prompt.trim().length > 0}
              generatingTitle={generatingTitle}
              currentTitle={currentTitle}
              batchProgress={batchProgress}
              remixDisabled={Boolean(remixId)}
            />
          </div>
        </main>
      </div>
      {showPreviewSpinner ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950/70 px-4 py-4 backdrop-blur">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-3 text-sm font-medium text-foreground shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            Loading preview…
          </div>
        </div>
      ) : null}
      <VideoPreviewOverlay
        isOpen={Boolean(preview.previewingId)}
        item={currentPreviewItem}
        previewUrl={preview.previewUrl}
        loading={preview.previewLoading}
        onClose={handlePreviewClose}
        onPrev={() => handlePreviewNavigate(-1)}
        onNext={() => handlePreviewNavigate(1)}
        hasPrev={hasPrevPreview}
        hasNext={hasNextPreview}
        onDownload={handleDownload}
      />
    </div>
  );
}
