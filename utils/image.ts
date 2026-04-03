export const cropImageToCover = (
  file: File,
  targetWidth: number,
  targetHeight: number,
): Promise<File> => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = () => {
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas context unavailable"));
      return;
    }

    const sourceRatio = img.width / img.height;
    const targetRatio = targetWidth / targetHeight;
    let sx: number;
    let sy: number;
    let sWidth: number;
    let sHeight: number;

    if (sourceRatio > targetRatio) {
      sHeight = img.height;
      sWidth = targetRatio * sHeight;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = img.width;
      sHeight = sWidth / targetRatio;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

    const outputType = file.type || "image/png";
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to process image"));
        return;
      }

      const ext = outputType.split("/")[1] || "png";
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const croppedFile = new File(
        [blob],
        `${baseName}-${targetWidth}x${targetHeight}.${ext}`,
        { type: outputType },
      );
      resolve(croppedFile);
    }, outputType);
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error("Unable to load image"));
  };

  img.src = url;
});

export const dataUrlToFile = async (
  dataUrl: string,
  filename = "generated.png",
): Promise<File> => {
  if (!dataUrl) throw new Error("Missing data URL");
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Failed to convert data URL");
  }
  const blob = await response.blob();
  const type = blob.type || "image/png";
  return new File([blob], filename, { type });
};

export const fetchImageAsFile = async (
  url: string,
  filename = "generated.png",
): Promise<File> => {
  if (!url) throw new Error("Missing image URL");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch image");
  }
  const blob = await response.blob();
  const type = blob.type || "image/png";
  return new File([blob], filename, { type });
};
