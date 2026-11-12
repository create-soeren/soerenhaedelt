import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

// Poster eines Videos: WebP in Originalgröße. Ein Video-Poster nimmt nur eine Adresse, kein srcset. Die Maße gehen ans
// Video, damit der Platz vor dem Laden steht (Poster und Video haben dasselbe Format).
export async function poster(img: ImageMetadata) {
  const out = await getImage({ src: img, format: "webp", quality: 82 });
  return { src: out.src, width: img.width, height: img.height };
}
