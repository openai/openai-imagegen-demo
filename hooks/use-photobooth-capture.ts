import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  PHOTOBOOTH_SUPPORTED_IMAGE_TYPES,
} from "@/lib/constants";
import { readFileAsDataUrl } from "@/lib/browser/file-utils";
import type { SelectedImage } from "@/types/photobooth";

const formatMegabytes = (bytes: number) =>
  `${Math.floor(bytes / (1024 * 1024))} MB`;

const normalizeFileType = (fileType: string) =>
  fileType.toLowerCase() === "image/jpg" ? "image/jpeg" : fileType.toLowerCase();

const supportedImageTypes: readonly string[] = PHOTOBOOTH_SUPPORTED_IMAGE_TYPES;

export const usePhotoboothCapture = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [isCameraLoading, setCameraLoading] = useState(false);
  const [isCameraReady, setCameraReady] = useState(false);
  const [isDragActive, setDragActive] = useState(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cameraRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!cameraStream) return;
      cameraStream.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    const video = videoRef.current;

    const markCameraReady = () => {
      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        setCameraReady(true);
        setCameraLoading(false);
      }
    };

    video.srcObject = cameraStream;
    video.addEventListener("loadeddata", markCameraReady);
    video.addEventListener("canplay", markCameraReady);
    video.play().then(markCameraReady).catch(() => {
      setCameraError("Unable to start camera preview.");
      setCameraLoading(false);
    });

    return () => {
      video.removeEventListener("loadeddata", markCameraReady);
      video.removeEventListener("canplay", markCameraReady);
      if (video.srcObject === cameraStream) {
        video.srcObject = null;
      }
    };
  }, [cameraStream]);

  const stopCamera = useCallback(() => {
    cameraRequestIdRef.current += 1;
    setCameraLoading(false);
    setCameraReady(false);
    setCameraStream((currentStream) => {
      currentStream?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  const resetCapture = useCallback(() => {
    setSelectedImage(null);
    setCameraError("");
    stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setSelectedImage(null);
    stopCamera();
    const requestId = cameraRequestIdRef.current + 1;
    cameraRequestIdRef.current = requestId;
    setCameraLoading(true);
    setCameraReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (!isMountedRef.current || cameraRequestIdRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setCameraStream(stream);
    } catch {
      if (isMountedRef.current && cameraRequestIdRef.current === requestId) {
        setCameraError("Camera access failed. You can still upload an image.");
        setCameraLoading(false);
      }
    }
  }, [stopCamera]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (
      !isCameraReady ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      setCameraError("Camera is still getting ready.");
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
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

    setSelectedImage({ dataUrl: canvas.toDataURL("image/png"), source: "camera" });
    stopCamera();
  }, [isCameraReady, stopCamera]);

  const openUploadPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setCameraError("Please drop or upload an image file.");
        return;
      }

      const fileType = normalizeFileType(file.type);
      if (!supportedImageTypes.includes(fileType)) {
        setCameraError("Please upload a PNG, JPEG, or WebP image.");
        return;
      }

      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        setCameraError(
          `Please upload an image smaller than ${formatMegabytes(
            MAX_IMAGE_UPLOAD_BYTES,
          )}.`,
        );
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setSelectedImage({ dataUrl, source: "upload" });
        setCameraError("");
        stopCamera();
      } catch {
        setCameraError("Unable to process uploaded image.");
      }
    },
    [stopCamera],
  );

  const onFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      await handleUploadFile(file);
      event.target.value = "";
    },
    [handleUploadFile],
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
    [handleUploadFile],
  );

  return {
    canvasRef,
    cameraError,
    cameraStream,
    fileInputRef,
    isCameraLoading,
    isCameraReady,
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
  };
};
