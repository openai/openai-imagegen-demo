"use client";

import { Camera, ImageUp, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { PHOTOBOOTH_STYLES, type PhotoboothStyleId } from "@/lib/photobooth-styles";
import { cn } from "@/lib/utils";

type SelectedImage = {
  dataUrl: string;
};

const STORAGE_KEY = "photobooth.request";
const MAX_SELECTED_STYLES = 4;
const STYLE_LIMIT_TOOLTIP = "You can select up to 4 styles at a time";
const DEFAULT_SELECTED_STYLES: PhotoboothStyleId[] = ["knitted", "digital-art"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read image file."));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<PhotoboothStyleId[]>(() => [
    ...DEFAULT_SELECTED_STYLES,
  ]);
  const [cameraError, setCameraError] = useState<string>("");
  const [isDragActive, setDragActive] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (!cameraStream) return;
      cameraStream.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
    videoRef.current.play().catch(() => {
      setCameraError("Unable to start camera preview.");
    });
  }, [cameraStream]);

  const stopCamera = useCallback(() => {
    if (!cameraStream) return;
    cameraStream.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  }, [cameraStream]);

  const resetAll = useCallback(() => {
    setSelectedImage(null);
    setSelectedStyles([...DEFAULT_SELECTED_STYLES]);
    setCameraError("");
    stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setSelectedImage(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
    } catch {
      setCameraError("Camera access failed. You can still upload an image.");
    }
  }, [stopCamera]);

  const onTakePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 960;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Keep captured output consistent with the mirrored camera preview.
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    context.restore();
    const dataUrl = canvas.toDataURL("image/png");
    setSelectedImage({
      dataUrl,
    });
    stopCamera();
  }, [stopCamera]);

  const onUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setCameraError("Please drop or upload an image file.");
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setSelectedImage({ dataUrl });
        stopCamera();
      } catch {
        setCameraError("Unable to process uploaded image.");
      }
    },
    [stopCamera]
  );

  const onFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await handleUploadFile(file);
      event.target.value = "";
    },
    [handleUploadFile]
  );

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragActive(false);
    }
  }, []);

  const onDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      await handleUploadFile(file);
    },
    [handleUploadFile]
  );

  const toggleStyle = useCallback((styleId: PhotoboothStyleId) => {
    setSelectedStyles((previous) =>
      previous.includes(styleId)
        ? previous.filter((id) => id !== styleId)
        : previous.length >= MAX_SELECTED_STYLES
          ? previous
          : [...previous, styleId]
    );
  }, []);

  const canContinue = useMemo(
    () => Boolean(selectedImage) && selectedStyles.length > 0,
    [selectedImage, selectedStyles]
  );

  const onGenerate = useCallback(() => {
    if (!selectedImage || !selectedStyles.length) return;

    const payload = {
      imageDataUrl: selectedImage.dataUrl,
      styleIds: selectedStyles,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    router.push("/results");
  }, [router, selectedImage, selectedStyles]);

  const renderStyleCard = (style: (typeof PHOTOBOOTH_STYLES)[number], compact = false) => {
    const active = selectedStyles.includes(style.id);
    const blocked = selectedStyles.length >= MAX_SELECTED_STYLES && !active;

    return (
      <div
        key={style.id}
        className={cn(
          "group relative",
          compact ? "w-[220px] shrink-0 sm:w-[240px]" : "",
          blocked ? "cursor-not-allowed" : ""
        )}
      >
        <button
          type="button"
          onClick={() => toggleStyle(style.id)}
          disabled={blocked}
          aria-disabled={blocked}
          aria-pressed={active}
          title={blocked ? STYLE_LIMIT_TOOLTIP : undefined}
          className={cn(
            "w-full rounded-xl border p-3 text-left transition-colors",
            active
              ? "border-primary bg-primary/10"
              : "border-border bg-background/90 hover:bg-accent",
            blocked ? "cursor-not-allowed opacity-60" : ""
          )}
        >
          <p className={cn("font-medium", compact ? "text-sm" : "text-sm")}>{style.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{style.description}</p>
        </button>
        {blocked ? (
          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg group-hover:block">
            {STYLE_LIMIT_TOOLTIP}
          </div>
        ) : null}
      </div>
    );
  };

  const stylesContent = (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-3">
          {PHOTOBOOTH_STYLES.map((style) => renderStyleCard(style))}
        </div>
      </div>

      <div className="border-t p-3">
        <Button
          className="h-11 w-full text-base"
          disabled={!canContinue}
          onClick={onGenerate}
        >
          Generate Styles
        </Button>
      </div>
    </div>
  );

  return (
    <main className="h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.17),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.16),transparent_50%)]" />

      <div className="relative flex h-full w-full flex-col gap-3 p-3 md:p-4 lg:flex-row">
        <section
          className={cn(
            "relative flex-1 overflow-hidden rounded-3xl border bg-card/80",
            isDragActive ? "border-primary ring-2 ring-primary/30" : ""
          )}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-20 size-12 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={resetAll}
            aria-label="Restart"
          >
            <RotateCcw className="size-7" />
          </Button>

          {selectedImage ? (
            <img
              src={selectedImage.dataUrl}
              alt="Selected portrait"
              className="h-full w-full object-cover"
            />
          ) : cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full -scale-x-100 object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <Camera className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Start camera, upload a photo, or drag and drop an image.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button onClick={startCamera} variant="outline">
                  <Camera data-icon="inline-start" />
                  Start Camera
                </Button>
                <Button onClick={onUploadClick} variant="secondary">
                  <ImageUp data-icon="inline-start" />
                  Upload Photo
                </Button>
              </div>
            </div>
          )}

          {cameraStream || selectedImage ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
              <Button
                size="icon"
                variant="ghost"
                className="pointer-events-auto size-14 rounded-full border border-white/70 bg-white/35 text-foreground shadow-lg backdrop-blur-md hover:bg-white/45 [&_svg]:size-6"
                onClick={cameraStream ? onTakePhoto : startCamera}
                aria-label={cameraStream ? "Capture photo" : "Retry"}
              >
                {cameraStream ? <Camera /> : <RotateCcw />}
              </Button>
            </div>
          ) : null}

          {isDragActive ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10 text-sm font-medium text-primary">
              Drop image to upload
            </div>
          ) : null}
        </section>

        <div className="mt-2 space-y-3 lg:hidden">
          <div className="-mx-1 overflow-x-auto pb-3">
            <div className="flex min-w-max gap-3 px-1">
              {PHOTOBOOTH_STYLES.map((style) => renderStyleCard(style, true))}
            </div>
          </div>

          <Button
            className="h-11 w-full text-base"
            disabled={!canContinue}
            onClick={onGenerate}
          >
            Generate Styles
          </Button>
        </div>

        <aside className="hidden h-full w-1/5 min-w-[260px] max-w-[340px] overflow-hidden rounded-3xl border bg-card/90 lg:block">
          {stylesContent}
        </aside>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        {cameraError ? (
          <p className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-destructive/10 px-4 py-1.5 text-sm text-destructive">
            {cameraError}
          </p>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
