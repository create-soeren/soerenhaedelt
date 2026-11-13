# soerenhaedelt.com

Portfolio von Sören Hädelt, gebaut mit Astro, gehostet auf GitHub Pages.

## Befehle

| Befehl | Was er tut |
| --- | --- |
| `npm run dev` | Entwicklungsserver auf localhost:4321 |
| `npm run check` | Lint CSS, Build mit Schema-Prüfung, Lint HTML. Läuft auch vor jedem Commit und beim Deployment. |

## Wo was liegt

- `src/pages/` – eine Datei pro Seite: Startseite, About, Projects, Contact, `cases/[slug]`.
- `src/layouts/Base.astro` – Hülle (Nav, Dark-Mode-Schalter, Glow) und der Schalter für Hell/Dunkel vor dem ersten Bild.
- `src/styles/site.css` und `src/scripts/site.js` – CSS und JavaScript der Seite, 1:1 aus dem Prototyp.
- `src/components/` – Case und Belege, gebaut aus der Collection. `Pic.astro` ist der Weg für jedes Bild: WebP in mehreren Breiten, `width` und `height` aus dem Bild, `sizes` sagt die Breite auf der Seite.
- `src/assets/` – Logos und Personenfotos (werden verarbeitet). Case-Bilder liegen in `src/content/cases/media/`.
- `src/lib/url.ts` – alle internen Adressen laufen über `base`.
- `src/data/projects.ts` – Projektliste.
- `src/content/cases/` – ein Case pro YAML-Datei, Bilder in `media/` daneben.
- `src/content.config.ts` – das Schema: welche Felder ein Case hat und welche Pflicht sind.
- `public/media/` – Videos (werden nicht verarbeitet, nur ausgeliefert). Das Poster eines Videos liegt als Bild in der Collection, seine Maße gehen ans Video.
- `src/styles/tokens.css` – Design-Tokens, erzeugt vom Prototype-Kit aus `design.md`. Nicht von Hand ändern.

## Token-Kit

Werte (Farben, Schrift, Abstände) stehen in `design.md` und werden mit dem Prototype-Kit eingestellt. Lokal liegt dafür eine
`kit.json` im Repo-Root (gitignored):

```json
{ "kit": "../prototype-kit", "design": "<pfad>/design.md", "out": "src/styles/tokens.css", "fonts": "src/fonts" }
```

Mit der Datei zeigt `npm run dev` jede Seite im Kit, `?present` zeigt sie ohne. "Speichern" schreibt `design.md` und
`tokens.css`, die Seite übernimmt die CSS ohne Neuladen. Ohne `kit.json` (auf GitHub Actions) läuft alles ohne Kit, der Build
nimmt die eingecheckte `tokens.css`.

## Spielwiese und Stände

Ein Versuch, der die Website nicht anfassen soll, läuft als Branch in einem eigenen Ordner mit eigenem Dev-Server und Kit.
Gestartet wird im Hauptordner auf `main`:

| Befehl | Was er tut |
| --- | --- |
| `npm run spiel -- <name>` | Branch `spiel/<name>` ab `main`, Ordner `../soerenhaedelt-spiel/<name>`, Server auf dem nächsten freien Port ab 4322, mit Kit. Gibt es die Spielwiese schon, wird sie wieder geöffnet. |
| `npm run spiel -- stand <name>` | Tag `stand/<name>` auf `main` (falls neu) als Ordner geöffnet, **ohne Kit**: genau die eingecheckte `tokens.css`. Der Vergleichsstand. |
| `npm run spiel -- list` | Alle Spielwiesen und Stände mit Adresse. |
| `npm run spiel -- weg <ordner>` | Server stoppen, Ordner entfernen. Branch und Tag bleiben. |

- Gespeichert wird per Commit auf dem Branch. Was überzeugt, kommt per Merge nach `main`, was nicht, wird verworfen (`git branch -D`).
- Das Kit schreibt auf der Spielwiese in eine Kopie von `design.md` (`../soerenhaedelt-spiel/<name>.design.md`), nie in die echte.
  Gewinnen dort Werte, werden sie von Hand in die echte `design.md` übernommen.
- Nicht eingecheckte Änderungen im Hauptordner gehen nicht in die Spielwiese über, sie startet vom letzten Commit auf `main`.
- Kleine Versuche brauchen keine Spielwiese: Kit-Varianten halten Token-Stände, Ausblenden im Kit ist eine Vorschau.

## Schriften

Selbst gehostet in `src/fonts/`, kein Request an Google oder Fontshare. Der Ordner gehört dem Kit: Es lädt die Dateien beim
Speichern und schreibt die `@font-face`-Regeln in `tokens.css`.

- Poppins (SIL Open Font License) liegt im Repo, mit `Poppins-OFL.txt`.
- Clash Display (ITF Free Font License) darf selbst gehostet, aber nicht über ein öffentliches Repo weitergegeben werden.
  Die Dateien sind gitignored, `scripts/fonts.mjs` lädt sie vor `dev` und `build` aus der Quelle in `fetch.json`. Lokal
  liegen sie schon, auf GitHub Actions lädt das Skript alle fünf.
- Clash Display 700 (alle Überschriften) wird im Layout vorgeladen.

## Stand

Seit 11.11.2026 ist dieses Repo die Quelle für Seiten und Cases. Der Prototyp (second-brain, `website-redesign-2026.html`, Stand `486dc63`) ist eingefroren und nur noch Referenz.
