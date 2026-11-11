// Überträgt die Cases aus dem Prototyp (const CASES in der HTML-Datei) in die Collection src/content/cases.
// Gilt bis zum Umstieg: Bis dahin ist der Prototyp die Quelle, dieses Skript läuft beim Umstieg ein letztes Mal
// und wird danach gelöscht. Es überschreibt die Collection und public/media komplett.
//
// Aufruf: npm run import:cases -- <pfad/zur/website-redesign-2026.html>

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { stringify } from "yaml";

const source = process.argv[2];
if (!source) throw new Error("Pfad zur Prototyp-HTML fehlt.");

const html = readFileSync(source, "utf8");
const start = html.indexOf("const CASES = {");
const end = html.indexOf("\n};", start);
if (start < 0 || end < 0) throw new Error("const CASES nicht gefunden.");
const CASES = new Function(`${html.slice(start, end + 3)}; return CASES;`)();

const root = new URL("..", import.meta.url).pathname;
const casesDir = join(root, "src/content/cases");
const imageDir = join(casesDir, "media");
const videoDir = join(root, "public/media");
const from = dirname(source);

rmSync(casesDir, { recursive: true, force: true });
rmSync(videoDir, { recursive: true, force: true });
mkdirSync(imageDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

// Bilder liegen neben den Cases (Astro prüft und optimiert sie), Videos in public (werden nicht verarbeitet).
const image = (path) => (cpSync(join(from, path), join(imageDir, basename(path))), `./media/${basename(path)}`);
const video = (path) => (cpSync(join(from, path), join(videoDir, basename(path))), basename(path));
const list = (label) => [].concat(label);

const figure = ({ src, alt, caption }) => ({ src: image(src), alt, ...(caption && { caption }) });
const evidence = (e) => {
  switch (e.kind) {
    case "image": return { kind: "image", ...figure(e) };
    case "pair": return { kind: "pair", items: e.items.map(figure) };
    case "video": return { kind: "video", src: video(e.src), poster: image(e.poster), alt: e.alt, ...(e.caption && { caption: e.caption }) };
    case "stat": return { kind: "stat", value: e.value, label: list(e.label) };
    default: return e; // quote, finding: nur Text
  }
};
const block = (b) => {
  switch (b.type) {
    case "chapter": return { type: "chapter", ...(b.struck && { struck: b.struck }), decision: b.decision, why: b.why, ...(b.evidence && { evidence: b.evidence.map(evidence) }) };
    case "showcase": return { type: "showcase", width: b.width, ...(b.portrait && { portrait: true }), items: b.items.map(evidence) };
    case "learnings": return { type: "learnings", items: b.items.map(([title, text]) => ({ title, text })) };
    case "quote": return { type: "quote", photo: image(b.photo), position: b.position, text: b.text, who: b.who };
    default: throw new Error(`Unbekannter Block-Typ: ${b.type}`);
  }
};
const head = (h) => {
  const meta = h.meta.map(([label, value]) => ({ label, value }));
  if (h.kind === "visual") {
    const m = h.media[0];
    return { kind: "visual", label: h.label, title: h.title, media: { poster: image(m.poster), ...(m.video && { video: video(m.video) }), alt: m.alt }, ...(h.caption && { caption: h.caption }), meta };
  }
  return { kind: "statement", label: h.label, title: h.title, from: h.from, to: h.to, ...(h.impact && { impact: { value: h.impact.value, label: list(h.impact.label) } }), meta };
};

const note = "# Generiert aus dem Prototyp (scripts/import-cases.mjs). Bis zum Umstieg hier nichts von Hand ändern,\n# der nächste Import überschreibt die Datei.\n";
for (const [slug, c] of Object.entries(CASES)) {
  const file = join(casesDir, `${slug.replaceAll("_", "-")}.yaml`);
  writeFileSync(file, note + stringify({ head: head(c.head), blocks: c.blocks.map(block) }, { lineWidth: 0 }));
  console.log("geschrieben", file.slice(root.length));
}
