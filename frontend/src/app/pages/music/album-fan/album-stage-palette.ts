/** A restrained, cover-derived lighting color. No network or browser dependencies. */
export interface AlbumStageRgb {
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_ALBUM_LIGHT: AlbumStageRgb = { r: 225, g: 145, b: 191 };

export function albumStageAccent(pixels: Uint8ClampedArray): AlbumStageRgb {
  let red = 0;
  let green = 0;
  let blue = 0;
  let weightSum = 0;

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.5) continue;

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const highest = Math.max(r, g, b);
    const lowest = Math.min(r, g, b);
    const chroma = highest - lowest;
    const lightness = (highest + lowest) / 2;

    // Ignore grayscale, deep shadows and highlights. Favor colors with some character.
    if (chroma < 24 || lightness < 38 || lightness > 226) continue;
    const weight = alpha * (chroma / 255) ** 2;
    red += r * weight;
    green += g * weight;
    blue += b * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return DEFAULT_ALBUM_LIGHT;

  // Stage lighting is softened so even highly saturated artwork stays readable.
  return {
    r: Math.round(Math.min(235, red / weightSum * 0.74 + 225 * 0.26)),
    g: Math.round(Math.min(225, green / weightSum * 0.74 + 145 * 0.26)),
    b: Math.round(Math.min(240, blue / weightSum * 0.74 + 191 * 0.26)),
  };
}
