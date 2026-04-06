export type PhotoboothStyleId =
  | "knitted"
  | "anime"
  | "digital-art"
  | "watercolor"
  | "futuristic"
  | "lofi-comic";

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
      "Transform this photo into a cozy handcrafted textile world. Render people as soft, cute knitted dolls with visible yarn, stitched fabric, embroidered facial details, and wool textures while preserving the same identity, pose, expression, framing, and scene layout.",
  },
  {
    id: "digital-art",
    label: "Digital Art",
    description: "Bold modern illustration with crisp shapes and vivid colors.",
    prompt:
      "Recreate this photo as clean modern digital art with bold shapes, smooth vector-like forms, balanced vivid colors, and crisp edges. Preserve the original people, pose, expression, and composition as closely as possible",
  },
  {
    id: "watercolor",
    label: "Watercolor",
    description: "Airy brushwork and delicate pastel atmosphere.",
    prompt:
      "Transform this photo into a beautiful, whimsical watercolor painting with fluid brush strokes, soft pigment bleeding, and delicate pastel depth while preserving the same subjects, proportions, composition, and expressions.",
  },
  {
    id: "anime",
    label: "Anime",
    description: "Soft cinematic anime look with painterly light.",
    prompt:
      "Reinterpret this photo in a cinematic anime illustration style with delicate linework, painterly shading, atmospheric lighting, and soft gradients. Keep the same people, composition, expressions, and scene structure.",
  },
  {
    id: "futuristic",
    label: "Futuristic",
    description:
      "Ethereal sci-fi glow with blue tones and futuristic cityscape.",
    prompt:
      "Transform this photo into a futuristic, ethereal sci-fi scene with a cool, vibrant blue color palette. Add neon glows around the subjects. Use smooth gradients, holographic lighting, and slightly reflective surfaces, and make sure the colors are vibrant and the contrast is high. Keep the same people, pose, expression, but change the background to be a futuristic, sci-fi scene like a new-generation, glowing cityscape with ambient energy fields.",
  },
  {
    id: "lofi-comic",
    label: "Lo-Fi Comic",
    description: "Graphic comic style with bold lines and soft retro colors.",
    prompt:
      "Reinterpret this photo as a stylish low-fi comic illustration with clean bold outlines, simplified shading, and slightly muted retro colors. Use soft halftone textures, minimal gradients, and graphic composition while keeping the same people, pose, expressions, and framing. The result should feel like a polished indie comic panel — simple but aesthetically refined.",
  },
];

export const findPhotoboothStyle = (id: string): PhotoboothStyle | undefined =>
  PHOTOBOOTH_STYLES.find((style) => style.id === id);
