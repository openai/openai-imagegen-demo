export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read image file."));
    };

    reader.onerror = () => reject(reader.error || new Error("File read failed."));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image file."));
    image.src = src;
  });

const getDataUrlMimeType = (dataUrl: string) => {
  const markerEnd = dataUrl.indexOf(";");
  if (!dataUrl.startsWith("data:") || markerEnd === -1) return "image/png";
  return dataUrl.slice(5, markerEnd) || "image/png";
};

type ResizeImageOptions = {
  maxDimension?: number;
  outputType?: string;
};

export const resizeImageDataUrl = async (
  dataUrl: string,
  { maxDimension = 1536, outputType }: ResizeImageOptions = {},
): Promise<string> => {
  const image = await loadImage(dataUrl);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);

  if (!longestSide || longestSide <= maxDimension) {
    return dataUrl;
  }

  const scale = maxDimension / longestSide;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to resize image file.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(outputType || getDataUrlMimeType(dataUrl));
};

export const resizeImageFileAsDataUrl = async (
  file: File,
  maxDimension = 1536,
): Promise<string> => {
  const dataUrl = await readFileAsDataUrl(file);
  return resizeImageDataUrl(dataUrl, {
    maxDimension,
    outputType: file.type,
  });
};

export const downloadUrl = (url: string, filename: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};
