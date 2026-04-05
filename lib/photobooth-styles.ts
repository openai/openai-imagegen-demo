export type PhotoboothStyleId =
  | "knitted"
  | "anime"
  | "digital-art"
  | "film-noir"
  | "watercolor"
  | "pop-art";

export type PhotoboothStyle = {
  id: PhotoboothStyleId;
  label: string;
  description: string;
  prompt: string;
};

export const PHOTOBOOTH_STYLES: PhotoboothStyle[] = [
  {
    id: "knitted",
    label: "Knitted",
    description: "Cozy yarn textures, stitched details, handcrafted charm.",
    prompt:
      "Transform this photo into a cozy handcrafted textile world. Render people as soft knitted dolls with visible yarn, stitched fabric, embroidered facial details, and wool textures while preserving the same identity, pose, expression, framing, and scene layout.",
  },
  {
    id: "anime",
    label: "Anime",
    description: "Soft cinematic anime look with painterly light.",
    prompt:
      "Reinterpret this photo in a cinematic anime illustration style with delicate linework, painterly shading, atmospheric lighting, and soft gradients. Keep the same people, composition, expressions, and scene structure.",
  },
  {
    id: "digital-art",
    label: "Digital Art",
    description: "Bold modern illustration with crisp shapes.",
    prompt:
      "Recreate this photo as clean modern digital art with bold shapes, smooth vector-like forms, balanced vivid colors, and crisp edges. Preserve the original people, pose, expression, and composition.",
  },
  {
    id: "film-noir",
    label: "Film Noir",
    description: "Monochrome cinematic drama and moody contrast.",
    prompt:
      "Transform this photo into a classic film noir portrait: monochrome palette, dramatic contrast, cinematic shadows, subtle grain, and timeless 1940s photography mood while keeping the same people, framing, and expressions.",
  },
  {
    id: "watercolor",
    label: "Watercolor",
    description: "Airy brushwork and delicate pastel atmosphere.",
    prompt:
      "Transform this photo into an elegant watercolor painting with fluid brush strokes, soft pigment bleeding, and delicate pastel depth while preserving the same subjects, proportions, composition, and expressions.",
  },
  {
    id: "pop-art",
    label: "Pop Art",
    description: "Bold halftones, punchy colors, and poster-style energy.",
    prompt:
      "Transform this photo into vibrant pop art with comic-style halftone textures, bold outlines, high-contrast color blocks, and graphic poster energy while preserving the same people, expressions, and framing.",
  },
];

export const findPhotoboothStyle = (
  id: string
): PhotoboothStyle | undefined => PHOTOBOOTH_STYLES.find((style) => style.id === id);
