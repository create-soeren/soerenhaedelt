import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Bauplan eines Case. Jedes Feld ohne .optional() ist Pflicht: Fehlt es, baut die Seite nicht.
// Bilder prüft image() (Datei muss existieren), Videos liegen in public/media und werden hier auf Existenz geprüft.

const text = z.string().min(1);
const lines = z.array(text).min(1);
const video = text.refine((file) => existsSync(join(process.cwd(), "public/media", file)), {
  message: "Video fehlt in public/media",
});

const cases = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/cases" }),
  schema: ({ image }) => {
    // rounded: Gerätebild mit schwarzen Ecken im JPG (kein Alpha), der Radius in der CSS deckt sie ab.
    const figure = { src: image(), alt: text, caption: text.optional(), rounded: z.boolean().optional() };
    const evidence = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("image"), ...figure }),
      z.object({ kind: z.literal("pair"), items: z.array(z.object(figure)).length(2) }),
      z.object({ kind: z.literal("video"), src: video, poster: image(), alt: text, caption: text.optional(), loop: z.boolean().optional() }),
      z.object({ kind: z.literal("stat"), value: text, label: lines }),
      z.object({ kind: z.literal("quote"), text, who: text }),
      z.object({ kind: z.literal("finding"), text, who: text }),
    ]);

    const block = z.discriminatedUnion("type", [
      z.object({
        type: z.literal("chapter"),
        struck: z.object({ label: text, text }).optional(),
        decision: text,
        why: lines,
        evidence: z.array(evidence).optional(),
      }),
      z.object({ type: z.literal("showcase"), width: z.enum(["half", "full"]), portrait: z.boolean().optional(), items: z.array(evidence).min(1) }),
      z.object({ type: z.literal("learnings"), items: z.array(z.object({ title: text, text })).min(1) }),
      // Das Foto bekommt seinen Alt-Text aus dem Namen in "who".
      z.object({ type: z.literal("quote"), photo: image(), position: text, text, who: text }),
    ]);

    const meta = z.array(z.object({ label: text, value: text })).min(1);
    const head = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("statement"), label: text, title: text, from: text, to: text, impact: z.object({ value: text, label: lines }).optional(), meta }),
      z.object({ kind: z.literal("visual"), label: text, title: text, media: z.object({ poster: image(), video: video.optional(), alt: text }), caption: text.optional(), meta }),
    ]);

    return z.object({ head, blocks: z.array(block).min(1) });
  },
});

export const collections = { cases };
