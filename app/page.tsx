"use client";

import { Camera, ImageUp, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { PHOTOBOOTH_STYLES, type PhotoboothStyleId } from "@/lib/photobooth-styles";
import { cn } from "@/lib/utils";

type SelectedImage = {
  dataUrl: string;
  source: "camera" | "upload";
  name: string;
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
      setCameraError("Unable to start video preview.");
    });
  }, [cameraStream]);

  const stopCamera = useCallback(() => {
    if (!cameraStream) return;
    cameraStream.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  }, [cameraStream]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
    } catch {
      setCameraError("Camera access failed. Please upload a photo instead.");
    }
  }, []);

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
      source: "camera",
      name: `camera-${Date.now()}.png`,
    });
    stopCamera();
  }, [stopCamera]);

  const onUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedImage({
        dataUrl,
        source: "upload",
        name: file.name || `upload-${Date.now()}.png`,
      });
      stopCamera();
    } catch {
      setCameraError("Unable to process uploaded image.");
    } finally {
      event.target.value = "";
    }
  }, [stopCamera]);

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
      source: selectedImage.source,
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    router.push("/results");
  }, [router, selectedImage, selectedStyles]);

  return (
    <main className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.2),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.2),transparent_45%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-8">
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Photobooth Demo
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">Capture your moment</h1>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedImage(null);
              setSelectedStyles([]);
              setCameraError("");
              stopCamera();
            }}
          >
            Reset
          </Button>
        </header>

        <section className="rounded-2xl border bg-card/90 p-4 shadow-sm md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button onClick={startCamera} variant="outline">
              <Camera data-icon="inline-start" />
              Start Camera
            </Button>
            <Button onClick={onTakePhoto} disabled={!cameraStream}>
              <Sparkles data-icon="inline-start" />
              Take Photo
            </Button>
            <Button onClick={onUploadClick} variant="secondary">
              <ImageUp data-icon="inline-start" />
              Upload Photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          <div className="overflow-hidden rounded-xl border bg-muted/50">
            {selectedImage ? (
              <img
                src={selectedImage.dataUrl}
                alt="Selected portrait"
                className="h-[46vh] w-full object-cover md:h-[56vh]"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  "h-[46vh] w-full object-cover md:h-[56vh]",
                  cameraStream ? "block" : "hidden"
                )}
              />
            )}

            {!selectedImage && !cameraStream ? (
              <div className="flex h-[46vh] w-full flex-col items-center justify-center gap-3 text-center text-muted-foreground md:h-[56vh]">
                <Camera />
                <p className="text-sm">Start camera or upload a photo to begin.</p>
              </div>
            ) : null}
          </div>

          {cameraError ? <p className="mt-3 text-sm text-destructive">{cameraError}</p> : null}
          <canvas ref={canvasRef} className="hidden" />
        </section>

        <section className="rounded-2xl border bg-card/90 p-4 shadow-sm md:p-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Choose styles</h2>
              <p className="text-sm text-muted-foreground">
                Multi-select the looks you want to generate.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {selectedStyles.length} selected
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PHOTOBOOTH_STYLES.map((style) => {
              const active = selectedStyles.includes(style.id);
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => toggleStyle(style.id)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  <p className="text-sm font-medium">{style.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{style.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-auto pb-2">
          <Button
            className="h-11 w-full text-base"
            disabled={!canContinue}
            onClick={onGenerate}
          >
            Generate Selected Styles
          </Button>
        </div>
      </div>
    </main>
  );
}
