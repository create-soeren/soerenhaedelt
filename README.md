# soerenhaedelt.com

Portfolio von Sören Hädelt, gebaut mit Astro, gehostet auf GitHub Pages.

## Befehle

| Befehl | Was er tut |
| --- | --- |
| `npm run dev` | Entwicklungsserver auf localhost:4321 |
| `npm run check` | Lint CSS, Build mit Schema-Prüfung, Lint HTML. Läuft auch vor jedem Commit und beim Deployment. |
| `npm run import:cases -- <prototyp.html>` | Überträgt die Cases aus dem Prototyp. Nur bis zum Umstieg. |

## Wo was liegt

- `src/pages/` – eine Datei pro Seite: Startseite, About, Projects, Contact, `cases/[slug]`.
- `src/layouts/Base.astro` – Hülle (Nav, Dark-Mode-Schalter, Glow) und der Schalter für Hell/Dunkel vor dem ersten Bild.
- `src/styles/site.css` und `src/scripts/site.js` – CSS und JavaScript der Seite, 1:1 aus dem Prototyp.
- `src/components/` – Case und Belege, gebaut aus der Collection.
- `src/lib/url.ts` – alle internen Adressen laufen über `base`.
- `src/data/projects.ts` – Projektliste.

- `src/content/cases/` – ein Case pro YAML-Datei, Bilder in `media/` daneben.
- `src/content.config.ts` – das Schema: welche Felder ein Case hat und welche Pflicht sind.
- `public/media/` – Videos (werden nicht verarbeitet, nur ausgeliefert).
- `src/styles/tokens.css` – Design-Tokens, erzeugt vom Prototype-Kit aus `design.md`. Nicht von Hand ändern.

## Stand

Bis zum Umstieg ist der Prototyp die Quelle für Startseite und Cases. Die YAML-Dateien sind generiert
und werden beim nächsten Import überschrieben.
