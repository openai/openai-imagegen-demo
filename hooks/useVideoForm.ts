import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import usePersistedState from "./usePersistedState";
import {
  DEFAULT_SIZE,
  MODEL_OPTIONS,
  SECONDS_OPTIONS,
  getModelSizeOptions,
  sanitizeModel,
  sanitizeSizeForModel,
  ensurePrompt,
  parseSize,
  sanitizeSeconds,
  type SoraModel,
  type SizeOptionGroups,
  type VideoItem,
  type SoraSeconds,
} from "../utils/video";
import { cropImageToCover, dataUrlToFile, fetchImageAsFile } from "../utils/image";

export interface ImagePreviewMeta {
  name: string;
  width: number;
  height: number;
}

export interface UseVideoFormResult {
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  model: SoraModel;
  setModel: Dispatch<SetStateAction<SoraModel>>;
  size: string;
  setSize: Dispatch<SetStateAction<string>>;
  seconds: SoraSeconds;
  setSeconds: Dispatch<SetStateAction<SoraSeconds>>;
  versionsCount: number;
  setVersionsCount: Dispatch<SetStateAction<number>>;
  remixId: string;
  setRemixId: Dispatch<SetStateAction<string>>;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  imagePreviewMeta: ImagePreviewMeta | null;
  handleImageSelect: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  applyImageFile: (file: File | null, currentSize?: string) => Promise<void>;
  handleGeneratedImageDataUrl: (dataUrl: string, filename?: string, currentSize?: string) => Promise<void>;
  handleGeneratedImageUrl: (url: string, filename?: string, currentSize?: string) => Promise<void>;
  clearForm: () => void;
  applyVideoToForm: (item: Partial<VideoItem> | null, currentPrompt?: string) => void;
  sizeOptionGroups: SizeOptionGroups;
}

const useVideoForm = (): UseVideoFormResult => {
  const [prompt, setPrompt] = useState<string>("");
  const [model, setModel] = usePersistedState<SoraModel>("sora.model", MODEL_OPTIONS[0]);
  const [size, setSize] = usePersistedState<string>("sora.size", DEFAULT_SIZE);
  const [seconds, setSeconds] = usePersistedState<SoraSeconds>("sora.seconds", "4");
  const [versionsCount, setVersionsCount] = usePersistedState<number>("sora.versions", 1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [remixId, setRemixId] = useState<string>("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePreviewMeta, setImagePreviewMeta] = useState<ImagePreviewMeta | null>(null);

  const resolvedModel = sanitizeModel(model);
  useEffect(() => {
    if (model !== resolvedModel) {
      setModel(resolvedModel);
    }
  }, [model, resolvedModel, setModel]);

  const resolvedSize = sanitizeSizeForModel(size, resolvedModel);
  useEffect(() => {
    if (size !== resolvedSize) {
      setSize(resolvedSize);
    }
  }, [size, resolvedSize, setSize]);

  const sizeOptionGroups = useMemo<SizeOptionGroups>(
    () => getModelSizeOptions(resolvedModel),
    [resolvedModel],
  );
  const lastCroppedImageKeyRef = useRef<string | null>(null);

  const clearImagePreview = useCallback(() => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    setImagePreviewMeta(null);
    lastCroppedImageKeyRef.current = null;
  }, [imagePreviewUrl]);

  useEffect(() => () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
  }, [imagePreviewUrl]);

  const applyCroppedImage = useCallback(async (file: File, sizeStr: string) => {
    const key = `${file.name || "file"}-${file.lastModified || ""}-${sizeStr}`;
    if (lastCroppedImageKeyRef.current === key) return;
    lastCroppedImageKeyRef.current = key;
    const { width, height } = parseSize(sizeStr);
    try {
      const cropped = await cropImageToCover(file, width, height);
      setImageFile(cropped);
      setImagePreviewMeta({
        name: cropped.name,
        width,
        height,
      });
      const nextUrl = URL.createObjectURL(cropped);
      setImagePreviewUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return nextUrl;
      });
    } catch (error) {
      lastCroppedImageKeyRef.current = null;
      throw error;
    }
  }, []);

  const applyImageFile = useCallback(async (file: File | null, currentSize = resolvedSize) => {
    if (!file) {
      setImageFile(null);
      setOriginalImageFile(null);
      clearImagePreview();
      return;
    }
    setOriginalImageFile(file);
    await applyCroppedImage(file, currentSize);
  }, [applyCroppedImage, clearImagePreview, resolvedSize]);

  const handleImageSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>, currentSize = resolvedSize) => {
    const file = event.target?.files?.[0];
    if (!file) {
      await applyImageFile(null, currentSize);
      return;
    }
    await applyImageFile(file, currentSize);
  }, [applyImageFile, resolvedSize]);

  const handleGeneratedImageDataUrl = useCallback(async (dataUrl: string, filename = "generated.png", currentSize = resolvedSize) => {
    const file = await dataUrlToFile(dataUrl, filename);
    await applyImageFile(file, currentSize);
  }, [applyImageFile, resolvedSize]);

  const handleGeneratedImageUrl = useCallback(async (url: string, filename = "generated.png", currentSize = resolvedSize) => {
    const file = await fetchImageAsFile(url, filename);
    await applyImageFile(file, currentSize);
  }, [applyImageFile, resolvedSize]);

  useEffect(() => {
    if (!originalImageFile) return;
    applyCroppedImage(originalImageFile, resolvedSize).catch(() => {
      /* ignore recrop errors */
    });
  }, [originalImageFile, resolvedSize, applyCroppedImage]);

  const resetImage = useCallback(() => {
    setImageFile(null);
    setOriginalImageFile(null);
    clearImagePreview();
  }, [clearImagePreview]);

  const clearForm = useCallback(() => {
    setPrompt("");
    resetImage();
    setRemixId("");
  }, [resetImage]);

  const applyVideoToForm = useCallback((item: Partial<VideoItem> | null, currentPrompt?: string) => {
    if (!item) return;
    const nextPrompt = ensurePrompt(item as VideoItem, currentPrompt ?? prompt);
    setPrompt(nextPrompt);
    const sanitizedModel = sanitizeModel((item.model as string | undefined) ?? MODEL_OPTIONS[0]);
    setModel(sanitizedModel);
    setSize(sanitizeSizeForModel((item.size as string | undefined) ?? DEFAULT_SIZE, sanitizedModel));
    setSeconds(sanitizeSeconds((item.seconds as string | number | null | undefined) ?? SECONDS_OPTIONS[0]));
    resetImage();
  }, [prompt, resetImage, setModel, setSeconds, setSize]);

  return {
    prompt,
    setPrompt,
    model: resolvedModel,
    setModel,
    size: resolvedSize,
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
    applyImageFile,
    handleGeneratedImageDataUrl,
    handleGeneratedImageUrl,
    clearForm,
    applyVideoToForm,
    sizeOptionGroups,
  };
};

export default useVideoForm;
