"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CaptureStage } from "@/components/photobooth/capture-stage";
import { DesktopStylePanel } from "@/components/photobooth/desktop-style-panel";
import { MobileStyleStrip } from "@/components/photobooth/mobile-style-strip";
import {
  DEFAULT_SELECTED_STYLE_IDS,
  MAX_SELECTED_STYLES,
} from "@/lib/constants";
import { savePhotoboothRequest } from "@/lib/photobooth-session";
import type { PhotoboothStyleId } from "@/lib/photobooth-styles";
import { usePhotoboothCapture } from "@/hooks/use-photobooth-capture";
import { DEFAULT_IMAGE_MODEL, isImageModelId, type ImageModelId } from "@/lib/image-models";

const MODEL_STORAGE_KEY = "photobooth-model";

export default function HomePage() {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL);
  const [selectedStyles, setSelectedStyles] = useState<PhotoboothStyleId[]>([
    ...DEFAULT_SELECTED_STYLE_IDS,
  ]);
  const {
    canvasRef,
    cameraError,
    cameraStream,
    fileInputRef,
    isDragActive,
    onDragLeave,
    onDragOver,
    onDrop,
    onFileChange,
    openUploadPicker,
    resetCapture,
    selectedImage,
    startCamera,
    takePhoto,
    videoRef,
  } = usePhotoboothCapture();
  const [generationError, setGenerationError] = useState("");

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
      if (isImageModelId(savedModel)) setSelectedModel(savedModel);
    } catch {
      // Keep the default when browser storage is unavailable.
    }
  }, []);

  const onModelChange = useCallback((model: ImageModelId) => {
    setSelectedModel(model);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch {
      // Model selection still works without persistence.
    }
  }, []);

  useEffect(() => {
    setGenerationError("");
  }, [selectedImage]);

  const onReset = useCallback(() => {
    resetCapture();
    setGenerationError("");
    setSelectedStyles([...DEFAULT_SELECTED_STYLE_IDS]);
  }, [resetCapture]);

  const toggleStyle = useCallback((styleId: PhotoboothStyleId) => {
    setSelectedStyles((previousStyles) =>
      previousStyles.includes(styleId)
        ? previousStyles.filter((id) => id !== styleId)
        : previousStyles.length >= MAX_SELECTED_STYLES
          ? previousStyles
          : [...previousStyles, styleId],
    );
  }, []);

  const canContinue = useMemo(
    () => Boolean(selectedImage) && selectedStyles.length > 0,
    [selectedImage, selectedStyles],
  );

  const onGenerate = useCallback(() => {
    if (!selectedImage || !selectedStyles.length) return;

    const didSave = savePhotoboothRequest({
      model: selectedModel,
      imageDataUrl: selectedImage.dataUrl,
      styleIds: selectedStyles,
    });

    if (!didSave) {
      setGenerationError(
        "This image is too large to prepare. Upload a smaller image.",
      );
      return;
    }

    setGenerationError("");
    router.push("/results");
  }, [router, selectedImage, selectedStyles, selectedModel]);

  const displayError = cameraError || generationError;

  return (
    <main className="min-h-dvh bg-background lg:h-dvh lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.17),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.16),transparent_50%)]" />

      <div className="relative flex min-h-dvh w-full flex-col gap-3 p-3 md:p-4 lg:h-full lg:flex-row">
        <CaptureStage
          cameraStream={cameraStream}
          isDragActive={isDragActive}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onReset={onReset}
          onStartCamera={startCamera}
          onTakePhoto={takePhoto}
          onUploadPhoto={openUploadPicker}
          selectedImageDataUrl={selectedImage?.dataUrl ?? null}
          selectedImageSource={selectedImage?.source ?? null}
          videoRef={videoRef}
        />

        <MobileStyleStrip
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          canGenerate={canContinue}
          onGenerate={onGenerate}
          onToggleStyle={toggleStyle}
          selectedStyleIds={selectedStyles}
        />

        <DesktopStylePanel
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          canGenerate={canContinue}
          onGenerate={onGenerate}
          onToggleStyle={toggleStyle}
          selectedStyleIds={selectedStyles}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        {displayError ? (
          <p className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-destructive/10 px-4 py-1.5 text-sm text-destructive">
            {displayError}
          </p>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
