import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Prüft beim Build, dass ein Video aus public/media dasselbe Seitenverhältnis hat wie sein Poster (sonst springt der
// Platz beim Laden oder das Poster wird beschnitten). Dass die Datei existiert, prüft schon das Schema (content.config.ts).
// Grenze: Handyvideos mit Rotationsmatrix melden vertauschte Maße, heute gibt es keins.

const TOLERANCE = 0.005;

// Breite und Höhe der ersten Videospur aus dem tkhd-Atom (16.16 Festkomma), ohne Abhängigkeit.
function mp4Size(b: Buffer): [number, number] | undefined {
  const found: [number, number][] = [];
  const walk = (start: number, end: number) => {
    for (let i = start; i + 8 <= end; ) {
      let size = b.readUInt32BE(i);
      const type = b.toString("latin1", i + 4, i + 8);
      let head = 8;
      if (size === 1) { size = Number(b.readBigUInt64BE(i + 8)); head = 16; }
      if (size === 0) size = end - i;
      if (size < head) break;
      if (type === "moov" || type === "trak") walk(i + head, i + size);
      else if (type === "tkhd") {
        const at = i + head + (b[i + head] === 1 ? 88 : 76);
        const w = b.readUInt32BE(at) / 65536, h = b.readUInt32BE(at + 4) / 65536;
        if (w && h) found.push([w, h]);
      }
      i += size;
    }
  };
  walk(0, b.length);
  return found[0];
}

export function checkVideo(file: string, poster: { width: number; height: number }) {
  const path = resolve("public/media", file);
  const size = mp4Size(readFileSync(path));
  if (!size) throw new Error(`Video ohne lesbare Maße: public/media/${file}`);
  const [w, h] = size;
  const video = w / h, still = poster.width / poster.height;
  if (Math.abs(video - still) / still > TOLERANCE)
    throw new Error(`Poster und Video passen nicht: public/media/${file} ist ${w} × ${h}, das Poster ${poster.width} × ${poster.height}`);
}
