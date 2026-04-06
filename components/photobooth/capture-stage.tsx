import { Camera, ImageUp, RotateCcw, X } from "lucide-react";
import type { DragEvent, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CaptureStageProps = {
  cameraStream: MediaStream | null;
  isDragActive: boolean;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void | Promise<void>;
  onReset: () => void;
  onStartCamera: () => void;
  onTakePhoto: () => void;
  onUploadPhoto: () => void;
  selectedImageDataUrl: string | null;
  selectedImageSource: "camera" | "upload" | null;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export const CaptureStage = ({
  cameraStream,
  isDragActive,
  onDragLeave,
  onDragOver,
  onDrop,
  onReset,
  onStartCamera,
  onTakePhoto,
  onUploadPhoto,
  selectedImageDataUrl,
  selectedImageSource,
  videoRef,
}: CaptureStageProps) => {
  const showBottomAction =
    cameraStream || (selectedImageDataUrl && selectedImageSource === "camera");

  return (
    <section
      className={cn(
        "relative flex-1 overflow-hidden rounded-3xl border bg-card/80",
        isDragActive ? "border-primary ring-2 ring-primary/30" : "",
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {cameraStream || selectedImageDataUrl ? (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-20 size-12 rounded-full bg-background/80 backdrop-blur-sm"
          onClick={onReset}
          aria-label="Close"
        >
          <X className="size-7" />
        </Button>
      ) : null}

      {selectedImageDataUrl ? (
        <img
          src={selectedImageDataUrl}
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
            <Button onClick={onStartCamera} variant="outline">
              <Camera data-icon="inline-start" />
              Start Camera
            </Button>
            <Button onClick={onUploadPhoto} variant="secondary">
              <ImageUp data-icon="inline-start" />
              Upload Photo
            </Button>
          </div>
        </div>
      )}

      {showBottomAction ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <Button
            size="icon"
            variant="ghost"
            className="pointer-events-auto size-14 rounded-full bg-white/35 text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.22)] backdrop-blur-md hover:bg-white/45 [&_svg]:size-6"
            onClick={cameraStream ? onTakePhoto : onStartCamera}
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
  );
};
