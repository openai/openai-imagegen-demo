import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { readFileAsDataUrl } from "@/lib/browser/file-utils";
import type { SelectedImage } from "@/types/photobooth";

export const usePhotoboothCapture = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [isDragActive, setDragActive] = useState(false);

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

  const resetCapture = useCallback(() => {
    setSelectedImage(null);
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

  const takePhoto = useCallback(() => {
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

    setSelectedImage({ dataUrl: canvas.toDataURL("image/png") });
    stopCamera();
  }, [stopCamera]);

  const openUploadPicker = useCallback(() => {
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

