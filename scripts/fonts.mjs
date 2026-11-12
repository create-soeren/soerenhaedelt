// Clash Display (ITF Free Font License) darf selbst gehostet, aber nicht über ein öffentliches Repo weitergegeben werden.
// Die Dateien sind deshalb gitignored (src/fonts/.gitignore, vom Kit geschrieben). src/fonts/fetch.json nennt ihre Quelle;
// dieses Skript lädt vor jedem Build, was fehlt. Lokal liegt alles schon, auf GitHub Actions lädt es alle.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../src/fonts/", import.meta.url);
const list = JSON.parse(readFileSync(new URL("fetch.json", dir), "utf8"));
for (const [file, src] of Object.entries(list)) {
  if (existsSync(new URL(file, dir))) continue;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}. Fontshare hat die Adresse vermutlich geändert: im Kit einmal speichern, dann committen.`);
  const font = Buffer.from(await res.arrayBuffer());
  if (font.subarray(0, 4).toString() !== "wOF2") throw new Error(`${file}: keine woff2-Datei unter ${src}`);
  writeFileSync(new URL(file, dir), font);
  console.log(`Schrift geladen: ${file}`);
}
