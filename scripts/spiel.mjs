// Spielwiese: ein Versuch an der Website, ohne den Live-Stand anzufassen. Jede Spielwiese ist ein Branch (spiel/<name>) in einem
// eigenen Arbeitsordner (git worktree, neben dem Repo in ../soerenhaedelt-spiel/) mit eigenem Dev-Server und Kit. Die Website
// läuft daneben wie gewohnt auf 4321. Gespeichert wird per Commit auf dem Branch.
//
//   npm run spiel -- <name>          Spielwiese anlegen oder wieder öffnen (Branch spiel/<name>, Port ab 4322)
//   npm run spiel -- stand <name>    Vergleichsstand: Tag stand/<name> auf main (falls neu), als Ordner geöffnet, ohne Kit
//   npm run spiel -- list            alle Spielwiesen und Stände, mit Adresse
//   npm run spiel -- weg <ordner>    Server stoppen, Ordner entfernen (Branch und Tag bleiben), <ordner> wie in list.
//                                    Bricht ab, wenn Nicht-Committetes oder neue Werte in der design.md-Kopie drin sind (--force)
//
// Das Kit schreibt auf der Spielwiese in eine Kopie von design.md (../soerenhaedelt-spiel/<name>.design.md), nicht in die echte.
// Ein Stand läuft ohne Kit: Er zeigt genau die eingecheckte tokens.css, die design.md von damals gibt es hier nicht.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = join(root, "..", "soerenhaedelt-spiel");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const hasRef = (ref) => spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: root }).status === 0;
const run = (cmd, args, cwd) => { if (spawnSync(cmd, args, { cwd, stdio: "inherit" }).status !== 0) throw new Error(`${cmd} ${args.join(" ")} ist fehlgeschlagen`); };
const fail = (msg) => { console.error(msg); process.exit(1); };
const NAME = /^[a-z0-9][a-z0-9-]*$/;

// Läuft der Dev-Server in diesem Ordner? Die Adresse steht in der Statusmeldung.
const running = (dir) => /running at (http:\/\/localhost:\d+)/.exec(spawnSync("npx", ["astro", "dev", "status"], { cwd: dir, encoding: "utf8" }).stdout)?.[1];
async function freePort(from) {
  for (let p = from; p < from + 80; p++) {
    const free = await new Promise((ok) => { const s = createServer(); s.once("error", () => ok(false)); s.listen(p, "127.0.0.1", () => s.close(() => ok(true))); });
    if (free) return p;
  }
  fail(`Kein freier Port ab ${from}`);
}

// Ordner anlegen (add), Abhängigkeiten, Kit-Anbindung (kit), Schriften, Server im Hintergrund.
async function open(key, add, kit) {
  const dir = join(home, key);
  if (!existsSync(dir)) { mkdirSync(home, { recursive: true }); add(dir); }
  if (!existsSync(join(dir, "node_modules"))) run("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], dir);
  if (kit) {
    const own = join(root, "kit.json");
    if (!existsSync(own)) fail("kit.json fehlt im Hauptordner: ohne das Kit gibt es keine Spielwiese.");
    const cfg = JSON.parse(readFileSync(own, "utf8")), design = join(home, `${key}.design.md`);
    if (!existsSync(design)) copyFileSync(resolve(root, cfg.design), design);
    writeFileSync(join(dir, "kit.json"), JSON.stringify({ ...cfg, kit: resolve(root, cfg.kit), design }));
  }
  run("npm", ["run", "fonts"], dir);
  let url = running(dir);
  if (!url) { run("npx", ["astro", "dev", "--background", "--port", String(await freePort(4322))], dir); url = running(dir); }
  console.log(`\n${key}: ${url}/soerenhaedelt/ ${kit ? "(mit Kit)" : "(ohne Kit)"}\nOrdner: ${dir}`);
}

const [cmd, arg] = process.argv.slice(2);
if (!cmd) fail("npm run spiel -- <name> | stand <name> | list | weg <ordner>");
if (!existsSync(join(root, ".git", "HEAD"))) fail("Bitte im Hauptordner starten, nicht in einer Spielwiese.");

if (cmd === "list") {
  const dirs = git("worktree", "list", "--porcelain").split("\n").filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9)).filter((d) => d.startsWith(home));
  if (!dirs.length) console.log("Keine Spielwiese.");
  for (const d of dirs) console.log(`${d.slice(home.length + 1).padEnd(24)} ${running(d) ?? "gestoppt"}`);
} else if (cmd === "weg") {
  const dir = join(home, arg ?? "");
  if (!arg || !existsSync(dir)) fail(`Kein Ordner "${arg}", siehe: npm run spiel -- list`);
  // Nicht entfernen, was sonst verloren ginge: Nicht-Committetes im Ordner, neue Werte in der design.md-Kopie.
  const copy = join(home, `${arg}.design.md`), own = join(root, "kit.json"), lost = [];
  if (spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }).stdout.trim()) lost.push("nicht committete Änderungen im Ordner");
  if (existsSync(copy) && existsSync(own) && readFileSync(copy, "utf8") !== readFileSync(resolve(root, JSON.parse(readFileSync(own, "utf8")).design), "utf8")) lost.push(`Werte in ${arg}.design.md, die in der echten design.md fehlen`);
  if (lost.length && !process.argv.includes("--force")) fail(`${arg} nicht entfernt, es gingen verloren: ${lost.join("; ")}.\nErst committen bzw. Werte in die echte design.md übernehmen. Trotzdem entfernen: npm run spiel -- weg ${arg} --force`);
  spawnSync("npx", ["astro", "dev", "stop"], { cwd: dir, stdio: "inherit" });
  run("git", ["worktree", "remove", "--force", dir], root);
  rmSync(copy, { force: true });
  console.log(arg.startsWith("stand-") ? `${arg} entfernt. Der Tag stand/${arg.slice(6)} bleibt (löschen: git tag -d stand/${arg.slice(6)}).`
    : `${arg} entfernt. Der Branch spiel/${arg} bleibt, mit allem, was darauf committet ist (löschen: git branch -D spiel/${arg}).`);
} else if (cmd === "stand") {
  if (!arg || !NAME.test(arg)) fail("Name: Kleinbuchstaben, Ziffern, Bindestrich. Beispiel: npm run spiel -- stand vor-launch");
  const tag = `stand/${arg}`;
  if (!hasRef(`refs/tags/${tag}`)) { git("tag", tag, "main"); console.log(`Tag ${tag} auf main (${git("rev-parse", "--short", "main")}) angelegt.`); }
  await open(`stand-${arg}`, (dir) => run("git", ["worktree", "add", "--detach", dir, tag], root), false);
} else {
  if (!NAME.test(cmd)) fail("Name: Kleinbuchstaben, Ziffern, Bindestrich. Beispiel: npm run spiel -- hero-neu");
  if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") fail("Eine neue Spielwiese startet von main: erst auf main wechseln.");
  const branch = `spiel/${cmd}`;
  await open(cmd, (dir) => run("git", hasRef(`refs/heads/${branch}`) ? ["worktree", "add", dir, branch] : ["worktree", "add", "-b", branch, dir, "main"], root), true);
}
