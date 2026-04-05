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
  const [selectedStyles, setSelectedStyles] = useState<PhotoboothStyleId[]>([]);
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
    setSelectedStyles([]);
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

    context.drawImage(video, 0, 0, width, height);
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

  return (
    <main className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.17),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.16),transparent_50%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 md:px-8 md:py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Photobooth
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="size-12 rounded-full"
            onClick={resetAll}
            aria-label="Restart"
          >
            <RotateCcw className="size-7" />
          </Button>
        </header>

        <section
          className={cn(
            "relative mt-5 overflow-hidden rounded-3xl border bg-card/80",
            isDragActive ? "border-primary ring-2 ring-primary/30" : ""
          )}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {selectedImage ? (
            <img
              src={selectedImage.dataUrl}
              alt="Selected portrait"
              className="h-[70svh] w-full object-cover"
            />
          ) : cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-[70svh] w-full object-cover"
            />
          ) : (
            <div className="flex h-[70svh] w-full flex-col items-center justify-center gap-6 px-4 text-center">
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

          {cameraStream ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
              <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-background/90 px-2 py-2 backdrop-blur-sm">
                <Button
                  size="icon"
                  className="size-12 rounded-full"
                  onClick={onTakePhoto}
                  aria-label="Capture photo"
                >
                  <Camera />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-12 rounded-full"
                  onClick={startCamera}
                  aria-label="Restart camera"
                >
                  <RotateCcw />
                </Button>
              </div>
            </div>
          ) : null}

          {isDragActive ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10 text-sm font-medium text-primary">
              Drop image to upload
            </div>
          ) : null}
        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        {cameraError ? (
          <p className="mt-2 text-sm text-destructive">{cameraError}</p>
        ) : null}

        <section className="mt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PHOTOBOOTH_STYLES.map((style) => {
              const active = selectedStyles.includes(style.id);
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => toggleStyle(style.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/90 hover:bg-accent"
                  )}
                >
                  <p className="text-sm font-medium">{style.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {style.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-auto flex justify-end pb-2 pt-6">
          <Button
            className="h-11 px-6 text-base"
            disabled={!canContinue}
            onClick={onGenerate}
          >
            Generate Selected Styles
          </Button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </main>
  );
}
