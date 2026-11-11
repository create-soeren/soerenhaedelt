const q = new URLSearchParams(location.search);
const PAGE = document.documentElement.dataset.p; // set per page in the layout
// Coffee or tea at the contact, see Cup. Nothing is chosen at first: the visitor's pick turns the pointer.
let DRINK = null;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const smoothstep = (t) => t * t * (3 - 2 * t);
const ease = (dt, keep) => 1 - Math.pow(keep, dt / 16.7);
// A soft overshoot: things click into place instead of bouncing.
const snap = (t) => 1 + 1.8 * Math.pow(t - 1, 3) + 0.8 * Math.pow(t - 1, 2);
const SVGNS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent && parent.appendChild(e);
  return e;
};
const h = (tag, cls, text, parent) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  parent && parent.append(e);
  return e;
};
// A token as #rrggbb. The build writes colours the short way (#000), so a short hex is expanded here.
const cssVar = (name) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{3}$/i.test(v) ? "#" + [...v.slice(1)].map((c) => c + c).join("") : v;
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Touch has no glow and no hover. ?touch simulates it on desktop.
const touch = q.has("touch") || matchMedia("(hover: none)").matches;
if (touch) document.documentElement.dataset.touch = ""; // the CSS keeps its hover states for pointers that hover

// Pointer: x/y raw, sx/sy smoothed.
const P = { x: innerWidth * 0.8, y: innerHeight * 0.7, sx: innerWidth * 0.8, sy: innerHeight * 0.7, presence: 0, inside: false, press: false };
// On touch the pointer is never "inside": a tap fires pointermove too, and no mouseleave ever takes the glow away again.
// Decided per event (11.11.), not only once at load: a touch laptop or an iPad with a trackpad reports hover, and a finger
// there would leave the glow standing at the tap. A finger counts only while it holds a long press (P.press).
const fingerOrTouch = (e) => touch || e.pointerType === "touch";
addEventListener("pointermove", (e) => { P.x = e.clientX; P.y = e.clientY; P.inside = P.press || !fingerOrTouch(e); });
addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && !P.press) P.inside = false; });
document.documentElement.addEventListener("mouseleave", () => { P.inside = false; });
const pointerIn = (r, pad = 0) => P.inside && P.x > r.left - pad && P.x < r.right + pad && P.y > r.top - pad && P.y < r.bottom + pad;

// Press (11.11.): on touch a long press on the hero, held still for PRESS_MS, lends the finger the cursor's part: glow,
// push of the headline, lean and gravity of the object follow it until it lifts. While it is held the page does not
// scroll; a swipe before that scrolls as usual. The touchmove listener is not passive for that reason, on the hero only.
const PRESS_MS = 350, PRESS_SLOP = 10;
const Press = { timer: 0, at: null, eat: false };
if (PAGE === "home") {
  const hero = document.querySelector(".hero");
  const end = () => {
    clearTimeout(Press.timer); Press.at = null;
    if (P.press) { P.press = false; P.inside = false; Press.eat = true; } // the click that follows must not toggle a pin
  };
  hero.addEventListener("touchstart", (e) => {
    Press.eat = false;
    if (e.touches.length !== 1) return end();
    const t0 = e.touches[0];
    Press.at = { x: t0.clientX, y: t0.clientY };
    clearTimeout(Press.timer);
    Press.timer = setTimeout(() => {
      P.press = true; P.inside = true;
      P.x = P.sx = G.x = Press.at.x; P.y = P.sy = G.y = Press.at.y; // the glow starts under the finger, it does not fly in
    }, PRESS_MS);
  }, { passive: true });
  hero.addEventListener("touchmove", (e) => {
    const t0 = e.touches[0];
    if (P.press) { e.preventDefault(); P.x = t0.clientX; P.y = t0.clientY; return; }
    if (Press.at && Math.hypot(t0.clientX - Press.at.x, t0.clientY - Press.at.y) > PRESS_SLOP) clearTimeout(Press.timer);
  }, { passive: false });
  hero.addEventListener("touchend", end);
  hero.addEventListener("touchcancel", end);
  hero.addEventListener("contextmenu", (e) => { if (P.press || Press.at) e.preventDefault(); });
}

// --- Glow knockout ------------------------------------------------------------------------------
// Orange phrases and headline words take a background-coloured spot under the glow, as before.

// Measured at the 510 px glow; GS scales the knockout and the push with the responsive glow.
const GLOW_R = 128;
let GS = 1;
function setGlowSpot(el) {
  const r = el.getBoundingClientRect(), st = el.style;
  st.setProperty("--gx", `${(G.x - r.left).toFixed(1)}px`);
  st.setProperty("--gy", `${(G.y - r.top).toFixed(1)}px`);
  st.setProperty("--gr", `${(GLOW_R * GS * G.presence * G.scale).toFixed(1)}px`);
}
const inkSpans = [...document.querySelectorAll(".ink")];

// Headlines that contain an ink span are not clipped themselves (their black would fringe the orange); their loose
// words become single-line spans instead. Nested wrappers (hero lines) are walked into; ink spans are left alone.
const knocked = [];
function wrapWords(el) {
  for (const node of [...el.childNodes]) {
    if (node.nodeType === Node.ELEMENT_NODE) { if (!node.classList.contains("ink")) wrapWords(node); continue; }
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
    const frag = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const s = document.createElement("span");
      s.textContent = part;
      frag.append(s);
      knocked.push(s);
    }
    node.replaceWith(frag);
  }
}
// Only the large headlines take the knockout; body copy, card captions and navigation stay as they are.
document.querySelectorAll("h1, h2").forEach((el) => {
  if (el.querySelector(".ink, .was")) wrapWords(el); else knocked.push(el);
});
// Each knocked text keeps its own colour in --c, read with the knockout off (it makes the text transparent). A theme
// change reads it again.
function readKnockColors() {
  knocked.forEach((el) => {
    el.classList.remove("knock");
    el.style.removeProperty("--c");
    el.style.setProperty("--c", getComputedStyle(el).color);
    el.classList.add("knock");
  });
}
readKnockColors();
const buttons = [...document.querySelectorAll(".btn")];
const updateKnock = () => {
  inkSpans.forEach(setGlowSpot); knocked.forEach(setGlowSpot); buttons.forEach(setGlowSpot);
  koIcons.forEach((svg) => (svg.isConnected ? koSpot(svg) : koIcons.delete(svg)));
};

// Icons under the glow (11.11.). background-clip: text does not reach SVG, so each icon draws twice inside its own
// SVG: itself outside the core, and a live <use> copy inside it, turned into the background colour as the headlines
// are (light page: white, dark page: dark). Both masks are the text's spot (45 % to 75 % of the radius), moved into the
// icon's own user space. Every filter takes its alpha from the distance to the background colour, so paint in that
// colour (LinkedIn's "in", the marks on the cards, the glyphs on the badge) becomes a hole and the glow shows through.
// Away from the glow both layers rest: no mask, the copy hidden, no writes. The icons on the glass (theme switch,
// coffee/tea) stay out: the glass damps the glow, a knockout there only lost contrast.
// One-colour icons (arrow, LinkedIn) take a plain silhouette (koSil). The ramp icons keep their steps as a tint
// (koTint, 11.11.): the ramp runs from ink to orange, so in the glow orange, the strongest step, turns pure background
// colour and the darker a step was, the more it keeps of the tint (chosen 11.11. over all steps flat).
const KO_RAMP = "koTint";
const koIcons = new Set();
let koId = 0;
const koDefs = svgEl("svg", { width: 0, height: 0, "aria-hidden": "true", style: "position: absolute" }, document.body);
const koF = (id) => svgEl("filter", { id, x: "-50%", y: "-50%", width: "200%", height: "200%", "color-interpolation-filters": "sRGB" }, koDefs);
const fe = (tag, attrs, parent) => svgEl(tag, attrs, parent);
const KO = {};
{ // Plain: the shape in the background colour.
  const f = koF("koSil");
  KO.silD = fe("feColorMatrix", { in: "SourceGraphic", type: "matrix", result: "d" }, f);
  fe("feComposite", { in: "d", in2: "SourceGraphic", operator: "in", result: "a" }, f);
  fe("feFlood", { style: "flood-color: var(--color-neutral)" }, f);
  fe("feComposite", { in2: "a", operator: "in" }, f);
}
{ // Tint: the step's place on the ramp (t, 0 at ramp 0, 1 at primary) into red, then the tint mixed toward the
  // background colour by t.
  const f = koF("koTint");
  KO.tintT = fe("feColorMatrix", { in: "SourceGraphic", type: "matrix", result: "t" }, f);
  KO.tintC = fe("feColorMatrix", { in: "t", type: "matrix", result: "c" }, f);
  KO.tintD = fe("feColorMatrix", { in: "SourceGraphic", type: "matrix", result: "d" }, f);
  fe("feComposite", { in: "c", in2: "d", operator: "in", result: "cd" }, f);
  fe("feComposite", { in: "cd", in2: "SourceGraphic", operator: "in", result: "tinted" }, f);
  // The tool marks on the cards come into the copy in a key green (--ko-mark, set on the copy) and leave it in primary,
  // all four the same orange. Holes would show the glow behind them, deeper at its centre than at its rim (11.11.).
  // Alpha = 4 * (g - r - b): full on the key, 0 for every page colour (none has more green than red).
  fe("feColorMatrix", { in: "SourceGraphic", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 4 -4 0 0", result: "mk" }, f);
  fe("feComposite", { in: "mk", in2: "SourceGraphic", operator: "in", result: "mka" }, f);
  fe("feFlood", { style: "flood-color: var(--color-primary)" }, f);
  fe("feComposite", { in2: "mka", operator: "in", result: "marks" }, f);
  const m = fe("feMerge", {}, f);
  fe("feMergeNode", { in: "tinted" }, m); fe("feMergeNode", { in: "marks" }, m);
}
// The filters' numbers come from the tokens and are set again on a theme change.
// d: alpha = the distance to the background colour (summed over r, g, b), 0 on it, full at the icon colour nearest to
// it. The light ground is the lightest colour on the page, the dark one the darkest: the sign follows the mode. A
// steeper slope saturates early and turns the soft edge between a fill and a detail in the background colour into a
// hard step (the badge's glyphs and the cards' outlines read pixelated, 11.11.).
// t: the projection of a colour onto the line from ramp 0 to primary, clamped to 0..1 by the matrix's output.
function setKoFilters() {
  const rgb = (v) => { const h = cssVar(v); return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
  const N = rgb("--color-neutral"), P = rgb("--color-primary"), r0 = rgb("--color-ramp-0");
  const sum = N[0] + N[1] + N[2], sign = sum > 1.5 ? -1 : 1;
  const near = Math.min(...["--color-ink", "--color-muted", "--color-ramp-0", "--color-ramp-1", "--color-ramp-2", "--color-primary"]
    .map((v) => sign * (rgb(v).reduce((a, c) => a + c, 0) - sum)));
  const s = (sign * 1.05) / near, D = `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${s.toFixed(4)} ${s.toFixed(4)} ${s.toFixed(4)} 0 ${(-s * sum).toFixed(4)}`;
  for (const m of [KO.silD, KO.tintD]) m.setAttribute("values", D);
  const d = P.map((v, i) => v - r0[i]), dd = d.reduce((a, v) => a + v * v, 0), w = d.map((v) => v / dd), off = -w.reduce((a, v, i) => a + v * r0[i], 0);
  KO.tintT.setAttribute("values", `${w.map((v) => v.toFixed(4)).join(" ")} 0 ${off.toFixed(4)}  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1`);
  // The darkest step at 35 % of the way from the background colour to primary, orange at the pure background colour.
  const tint = N.map((v, i) => v + (P[i] - v) * 0.35);
  KO.tintC.setAttribute("values", [0, 1, 2].map((i) => `${(N[i] - tint[i]).toFixed(4)} 0 0 0 ${tint[i].toFixed(4)}`).join("  ") + "  0 0 0 0 1");
}
setKoFilters();
function iconKnock(svg, filter = "koSil") {
  if (touch) return;
  const id = `ko${++koId}`, defs = svgEl("defs");
  const layer = (core, rim, suffix) => {
    const g = svgEl("radialGradient", { id: `${id}g${suffix}`, gradientUnits: "userSpaceOnUse", cx: -999, cy: -999, r: 0 }, defs);
    svgEl("stop", { offset: 0.45, "stop-color": core }, g);
    svgEl("stop", { offset: 0.75, "stop-color": rim }, g);
    const m = svgEl("mask", { id: `${id}m${suffix}`, maskUnits: "userSpaceOnUse", x: -2000, y: -2000, width: 4000, height: 4000 }, defs);
    svgEl("rect", { x: -2000, y: -2000, width: 4000, height: 4000, fill: `url(#${id}g${suffix})` }, m);
    return g;
  };
  const gIn = layer("#fff", "#000", "i"), gOut = layer("#000", "#fff", "o");
  const art = svgEl("g", { id });
  art.append(...svg.childNodes);
  const base = svgEl("g", {}, svg);
  base.append(art);
  svg.prepend(defs);
  const top = svgEl("use", { href: `#${id}`, mask: `url(#${id}mi)`, filter: `url(#${filter})`, display: "none", style: "--ko-mark: #00ff00" }, svg);
  svg._ko = { id, gIn, gOut, base, top, on: false };
  koIcons.add(svg);
}
function koSpot(svg) {
  const k = svg._ko, R = GLOW_R * GS * G.presence * G.scale, r = svg.getBoundingClientRect();
  const near = R >= 1 && r.width > 0 && Math.hypot(Math.max(r.left - G.x, 0, G.x - r.right), Math.max(r.top - G.y, 0, G.y - r.bottom)) < R;
  if (near !== k.on) {
    k.on = near;
    k.top.setAttribute("display", near ? "inline" : "none");
    if (near) k.base.setAttribute("mask", `url(#${k.id}mo)`); else k.base.removeAttribute("mask");
  }
  const m = near && svg.getScreenCTM();
  if (!m) return;
  const inv = m.inverse(), p = new DOMPoint(G.x, G.y).matrixTransform(inv), s = Math.hypot(inv.a, inv.b);
  for (const g of [k.gIn, k.gOut]) { g.setAttribute("cx", p.x.toFixed(2)); g.setAttribute("cy", p.y.toFixed(2)); g.setAttribute("r", (R * s).toFixed(2)); }
}
document.querySelectorAll(".next svg, .social svg").forEach((svg) => iconKnock(svg));

// The glow follows with the same easing as the first sketch's probe. It also moves the annotations' knockout.
const glowEl = document.getElementById("glow");
const measureGlow = () => (GS = glowEl.offsetWidth / 510);
measureGlow();
addEventListener("resize", measureGlow);
const G = { x: P.x, y: P.y, px: P.x, py: P.y, presence: 0, scale: 1, mute: 0 };
function updateGlow(dt) {
  const k = reduced ? 1 : ease(dt, 0.82);
  G.px = G.x; G.py = G.y;
  G.x = lerp(G.x, P.x, k); G.y = lerp(G.y, P.y, k);
  // Shrinks the glow further toward the pin.
  G.scale = lerp(1, 0.3, Calm.k);
  // In the contact the glow goes while the pot or the bag is the pointer: from the pick until the button is full.
  // Before a pick and once served it is there as everywhere.
  // Over a video the glow goes as well: the video is opaque, so the glow would only bleed around its edges.
  const sec = contact.getBoundingClientRect(), brewing = !!DRINK && Cup.fill < 1;
  const overVideo = [...document.querySelectorAll("video")].some((v) => pointerIn(v.getBoundingClientRect()));
  G.mute = lerp(G.mute, (pointerIn(sec) && brewing) || overVideo ? 1 : 0, reduced ? 1 : ease(dt, 0.8));
  G.presence = P.presence * (1 - G.mute);
  glowEl.style.transform = `translate(${G.x}px, ${G.y}px) scale(${G.scale.toFixed(3)})`;
  glowEl.style.opacity = G.presence;
  for (const g of S.grads) { g.setAttribute("cx", G.x.toFixed(1)); g.setAttribute("cy", G.y.toFixed(1)); g.setAttribute("r", (GLOW_R * GS * G.presence * G.scale).toFixed(1)); }
}

// --- Icons --------------------------------------------------------------------------------------

const ICONS = {
  // Chosen 27.10.: scattered squares fall into a grid. In the ramp since 11.11. like the other five: column plus row
  // gives the four steps along the diagonal, top left darkest, bottom right orange. Each square turns from ink into its
  // step over the second half of the fall.
  simplify(svg) {
    const ink = cssVar("--color-ink");
    const pieces = Array.from({ length: 6 }, (_, i) => ({
      from: { x: 24 + Math.sin(i * 2.1) * 16, y: 24 + Math.cos(i * 1.3) * 15, r: i * 47 },
      to: { x: 13 + (i % 3) * 11, y: 18 + Math.floor(i / 3) * 11 },
      c: RAMP[(i % 3) + Math.floor(i / 3)],
      el: svgEl("rect", { width: 8, height: 8, x: -4, y: -4, fill: ink, stroke: "none" }, svg),
    }));
    return (p) => pieces.forEach(({ from, to, c, el }) => {
      el.setAttribute("transform", `translate(${lerp(from.x, to.x, p).toFixed(1)} ${lerp(from.y, to.y, p).toFixed(1)}) rotate(${lerp(from.r, 0, p).toFixed(1)})`);
      el.setAttribute("fill", mixHex(ink, c, seg(p, 0.5, 1)));
    });
  },
  // Satisfaction, chosen 30.10.: a geometric heart (a square on its corner, two circles) fills up and pops once at the
  // end. On Sören's 96 grid and his ink-to-orange ramp. Since 11.11. in three bands of equal height like the funnel
  // (ramp 1 to orange at the top, joints the funnel's 1.5) over the grey ghost. The bottom band is full from the start,
  // the second and third come in with the run.
  satisfaction(svg) {
    const g = wideGroup(svg), TOP = 17.86, BOTTOM = 80.28, H = BOTTOM - TOP, id = `heart${++clipId}`, JOINT = 1.5;
    // The square on its corner with a half circle on each upper edge, as one path.
    const D = "M 48 80.28 L 19.72 52 A 20 20 0 0 1 48 23.72 A 20 20 0 0 1 76.28 52 Z";
    const defs = svgEl("defs", {}, g), clip = (cid, attrs) => svgEl("rect", attrs, svgEl("clipPath", { id: cid }, defs));
    const level = clip(id, { x: 0, width: 96 });
    const pop = svgEl("g", {}, g);
    svgEl("path", { d: D, fill: RAMP[0], opacity: 0.12 }, pop);
    // Band edges from the bottom, thirds of the height.
    const edges = [BOTTOM + 10, BOTTOM - H / 3, BOTTOM - (2 * H) / 3, TOP - 10];
    const fill = svgEl("g", { "clip-path": `url(#${id})` }, pop);
    RAMP.slice(1).forEach((c, i) => {
      const bid = `${id}b${i}`, y0 = edges[i + 1] + (i < 2 ? JOINT / 2 : 0), y1 = edges[i] - (i > 0 ? JOINT / 2 : 0);
      clip(bid, { x: 0, y: y0.toFixed(2), width: 96, height: (y1 - y0).toFixed(2) });
      svgEl("path", { d: D, fill: c, "clip-path": `url(#${bid})` }, fill);
    });
    return (p) => {
      const h = H * lerp(1 / 3, 1, p);
      level.setAttribute("y", (BOTTOM - h).toFixed(2)); level.setAttribute("height", h.toFixed(2));
      const s = 1 + 0.12 * Math.sin(Math.PI * seg(p, 0.85, 1));
      pop.setAttribute("transform", `translate(48 49) scale(${s.toFixed(3)}) translate(-48 -49)`);
    };
  },
  // Sören's redraw 30.10.: four filled bars, black while flat, growing in a staggered run into his ink-to-orange ramp.
  customers(svg) {
    const g = wideGroup(svg), tops = [68, 52, 36, 16];
    const bars = tops.map((_, i) => svgEl("rect", { x: 16 + i * 18, width: 12 }, g));
    return (p) => bars.forEach((b, i) => {
      const k = easeOut(clamp(p * 1.6 - i * 0.2)), h = lerp(4, 84 - tops[i], k), c = mixHex(cssVar("--color-ink"), RAMP[i], k);
      b.setAttribute("y", (84 - h).toFixed(2)); b.setAttribute("height", h.toFixed(2));
      b.setAttribute("fill", c); b.setAttribute("stroke", c);
    });
  },
  // Skill icons, filled on the 96 grid in the ramp like the Anita row, so both rows speak one language. Each starts as
  // a faint ghost so it reads unplayed.

  // Marketing, chosen 30.10.: the funnel diagram every marketing deck has, an inverted triangle in four equal stages
  // that drop in one by one, the tip in orange. The joint is GAP minus the rounding stroke.
  marketing(svg) {
    const g = wideGroup(svg), T = 16, B = 82, half = (y) => (34 * (B - y)) / (B - T), STROKE = 2, GAP = 1.5 + STROKE;
    const band = (B - T - 3 * GAP) / 4;
    const bands = [0, 1, 2, 3].map((i) => {
      const y0 = T + i * (band + GAP), y1 = y0 + band, pts = [[48 - half(y0), y0], [48 + half(y0), y0], [48 + half(y1), y1], [48 - half(y1), y1]];
      return svgEl("path", { d: `M ${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")} Z`, "stroke-linejoin": "round", "stroke-width": STROKE }, g);
    });
    return (p) => bands.forEach((b, i) => {
      const k = easeOutBack(seg(p, i * 0.15, 0.3 + i * 0.15)), c = k > 0 ? RAMP[i] : RAMP[0];
      b.setAttribute("fill", c); b.setAttribute("stroke", c);
      b.setAttribute("opacity", (0.12 + 0.88 * clamp(k)).toFixed(3));
      b.setAttribute("transform", `translate(0 ${lerp(-8, 0, k).toFixed(2)})`);
    });
  },
  // Certificates, chosen 30.10.: one badge for the business bachelor and the frontend certificates, a flat-top
  // hexagon cut across at its widest, business on top, code below. The halves slide together.
  certificates(svg) {
    const g = svgEl("g", {}, wideGroup(svg)), r = 40, h = r * 0.866, GAP = 2.5;
    const v = [[48 + r, 48], [48 + r / 2, 48 + h], [48 - r / 2, 48 + h], [48 - r, 48], [48 - r / 2, 48 - h], [48 + r / 2, 48 - h]];
    const poly = (pts, dy, fill, parent) => svgEl("path", { d: `M ${pts.map(([x, y]) => `${x.toFixed(2)} ${(y + dy).toFixed(2)}`).join(" L ")} Z`, fill, "stroke-linejoin": "round" }, parent);
    const top = svgEl("g", {}, g), bottom = svgEl("g", {}, g);
    poly([v[3], v[4], v[5], v[0]], -GAP, RAMP[1], top);
    poly([v[0], v[1], v[2], v[3]], GAP, RAMP[3], bottom);
    // The signs at 70 % of the usual stroke, lighter against the solid halves.
    const trend = trendGlyph(top, { cx: 48, cy: 30, s: 1.05, w: 0.7 }), code = codeGlyph(bottom, { cx: 48, cy: 66, s: 0.82, w: 0.7 });
    return (p) => {
      const k = easeOutBack(seg(p, 0, 0.45));
      top.setAttribute("transform", `translate(0 ${lerp(-12, 0, k).toFixed(2)})`); bottom.setAttribute("transform", `translate(0 ${lerp(12, 0, k).toFixed(2)})`);
      for (const el of [top, bottom]) el.setAttribute("opacity", (0.12 + 0.88 * seg(p, 0, 0.15)).toFixed(3));
      trend(seg(p, 0.4, 0.75)); code(seg(p, 0.5, 1));
      popAt(g, p, 48, 48, 0.06);
    };
  },
  // State of mind tool using, chosen 30.10.: the tools as a hand of cards that fans out, Figma, Gemini, WordPress,
  // and Claude on top in orange. Pick the card the job needs. The large cards, fanned wide; at ±48° the outer
  // corners reach about 3 units past the 96 grid on each side.
  mindset(svg) {
    return cardFan(svg, { marks: [markFigma, markGemini, markWordPress, markClaude], fills: RAMP, w: 36, h: 52, angles: [-48, -16, 16, 48], py: 64, r: 7.5, index: 11 });
  },
};
// Tool marks, centred on (cx, cy), drawn in currentColor so the caller sets one colour. Stand-ins
// for the official marks from the brand kits.
function markFigma(g, cx, cy, u) {
  const m = svgEl("g", { fill: "currentColor" }, g);
  figmaMark(m, cx, cy, u).removeAttribute("stroke");
  return m;
}
function markClaude(g, cx, cy, r) {
  const m = svgEl("g", { stroke: "currentColor" }, g);
  claudeSpark(m, cx, cy, r);
  return m;
}
function markGemini(g, cx, cy, r) {
  const m = svgEl("g", { fill: "currentColor" }, g), c = r * 0.18;
  svgEl("path", { d: `M ${cx} ${cy - r} Q ${cx + c} ${cy - c} ${cx + r} ${cy} Q ${cx + c} ${cy + c} ${cx} ${cy + r} Q ${cx - c} ${cy + c} ${cx - r} ${cy} Q ${cx - c} ${cy - c} ${cx} ${cy - r} Z` }, m);
  return m;
}
function markWordPress(g, cx, cy, r) {
  const m = svgEl("g", { stroke: "currentColor", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  svgEl("circle", { cx, cy, r: r - 1.2, "stroke-width": 2.4 }, m);
  const w = r * 0.62;
  svgEl("path", { d: `M ${cx - w} ${cy - w * 0.55} L ${cx - w * 0.5} ${cy + w * 0.7} L ${cx} ${cy - w * 0.25} L ${cx + w * 0.5} ${cy + w * 0.7} L ${cx + w} ${cy - w * 0.55}`, "stroke-width": 2.2 }, m);
  return m;
}
// Business glyph: a rising trend with an arrow head, knocked out in background colour. Returns its update, it draws.
function trendGlyph(g, { cx, cy, s, w = 1 }) {
  const st = { fill: "none", stroke: "var(--color-neutral)", "stroke-width": 6 * s * w, "stroke-linecap": "round", "stroke-linejoin": "round" };
  const P = (x, y) => `${(cx + x * s).toFixed(2)} ${(cy + y * s).toFixed(2)}`;
  const line = svgEl("path", { d: `M ${P(-13, 9)} L ${P(-4, 0)} L ${P(2, 6)} L ${P(13, -6)}`, ...st }, g), len = line.getTotalLength();
  const head = svgEl("path", { d: `M ${P(4, -7)} L ${P(13, -6)} L ${P(12, 3)}`, ...st }, g);
  return (p) => {
    line.setAttribute("stroke-dasharray", `${(len * seg(p, 0, 0.8)).toFixed(2)} ${len.toFixed(2)}`);
    line.setAttribute("opacity", p > 0 ? 1 : 0);
    head.setAttribute("opacity", seg(p, 0.75, 1).toFixed(3));
  };
}
// Figma's mark in five pieces of u, centred on (cx, cy), one colour (set by the caller through fill).
function figmaMark(g, cx, cy, u) {
  const X = cx - u, Y = cy - 1.5 * u, r = u / 2, m = svgEl("g", { stroke: "none" }, g);
  svgEl("path", { d: `M ${X + u} ${Y} H ${X + r} A ${r} ${r} 0 0 0 ${X + r} ${Y + u} H ${X + u} Z M ${X + u} ${Y} H ${X + u + r} A ${r} ${r} 0 0 1 ${X + u + r} ${Y + u} H ${X + u} Z M ${X + u} ${Y + u} H ${X + r} A ${r} ${r} 0 0 0 ${X + r} ${Y + 2 * u} H ${X + u} Z M ${X + r} ${Y + 2 * u} H ${X + u} V ${Y + 2 * u + r} A ${r} ${r} 0 1 1 ${X + r} ${Y + 2 * u} Z` }, m);
  svgEl("circle", { cx: X + u + r, cy: Y + u + r, r }, m);
  return m;
}
// A stand-in for Claude's spark: twelve rounded rays of uneven length.
function claudeSpark(g, cx, cy, r) {
  const lens = [1, 0.8, 0.95, 0.75, 1, 0.85, 0.9, 0.78, 1, 0.82, 0.92, 0.76];
  const d = lens.map((l, i) => { const a = (i * Math.PI) / 6 - Math.PI / 2; return `M ${cx} ${cy} L ${(cx + r * l * Math.cos(a)).toFixed(2)} ${(cy + r * l * Math.sin(a)).toFixed(2)}`; }).join(" ");
  return svgEl("path", { d, fill: "none", "stroke-width": r * 0.24, "stroke-linecap": "round" }, g);
}
// The code glyph, knocked out of a badge in background colour, centred on (cx, cy) at s times its base size, its
// stroke w times the usual. Returns its update; the brackets open, then the slash is drawn.
function codeGlyph(g, { cx, cy, s, w = 1 }) {
  const o = 11 * s, sx = 13 * s, lx = cx - 11 * s, rx = cx + 11 * s;
  const st = { fill: "none", stroke: "var(--color-neutral)", "stroke-width": 6 * s * w, "stroke-linecap": "round", "stroke-linejoin": "round" };
  const left = svgEl("path", { d: `M ${lx} ${cy - o} L ${lx - o} ${cy} L ${lx} ${cy + o}`, ...st }, g);
  const right = svgEl("path", { d: `M ${rx} ${cy - o} L ${rx + o} ${cy} L ${rx} ${cy + o}`, ...st }, g);
  const slash = svgEl("path", { d: `M ${cx + sx * 0.33} ${cy - sx * 1.1} L ${cx - sx * 0.33} ${cy + sx * 1.1}`, ...st }, g), len = slash.getTotalLength();
  return (p) => {
    const k = easeOutBack(seg(p, 0, 0.4));
    left.setAttribute("transform", `translate(${lerp(6 * s, 0, k).toFixed(2)} 0)`); right.setAttribute("transform", `translate(${lerp(-6 * s, 0, k).toFixed(2)} 0)`);
    for (const el of [left, right]) el.setAttribute("opacity", p > 0 ? 1 : 0);
    // Hidden until it starts, or the round cap of an empty dash shows as a dot.
    slash.setAttribute("stroke-dasharray", `${(len * seg(p, 0.3, 0.6)).toFixed(2)} ${len.toFixed(2)}`);
    slash.setAttribute("opacity", p > 0.3 ? 1 : 0);
  };
}
// The tool cards: a hand that fans out around the cards' bottom centre (48, py). Each card carries its mark in the
// corner like a card's index, knocked out in background colour; the last card lies on top.
function cardFan(svg, { marks, fills, w, h, angles, py, r, index }) {
  const g = svgEl("g", {}, wideGroup(svg)), px = 48;
  const cards = marks.map((mark, i) => {
    const c = svgEl("g", {}, g);
    svgEl("rect", { x: px - w / 2, y: py - h, width: w, height: h, rx: w * 0.2, fill: fills[i], stroke: "var(--color-neutral)", "stroke-width": 2.5, "paint-order": "stroke" }, c);
    // Under the glow the knockout copy keys the marks green (--ko-mark) and paints them orange.
    mark(c, px - w / 2 + index, py - h + index, mark === markFigma ? r * 0.7 : r).setAttribute("color", "var(--ko-mark, var(--color-neutral))");
    return c;
  });
  return (p) => cards.forEach((c, i) => {
    const k = easeOutBack(seg(p, 0.1 + i * 0.1, 0.55 + i * 0.1));
    c.setAttribute("opacity", (0.12 + 0.88 * seg(p, 0, 0.12)).toFixed(3));
    c.setAttribute("transform", `rotate(${lerp(0, angles[i], k).toFixed(1)} ${px} ${py}) translate(0 ${lerp(4, 0, clamp(k)).toFixed(2)})`);
  });
}
// One pop at the end of the run, scaled around (x, y).
function popAt(el, p, x, y, amount) {
  const s = 1 + amount * Math.sin(Math.PI * seg(p, 0.85, 1));
  el.setAttribute("transform", `translate(${x.toFixed(2)} ${y}) scale(${s.toFixed(3)}) translate(${(-x).toFixed(2)} ${-y})`);
}

const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

// Sören's ramp from the redrawn customers icon, ink to orange.
const RAMP_VARS = ["--color-ramp-0", "--color-ramp-1", "--color-ramp-2", "--color-primary"];
const RAMP = RAMP_VARS.map(cssVar);
const mixHex = (a, b, t) => "#" + [1, 3, 5].map((i) =>
  Math.round(lerp(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), clamp(t))).toString(16).padStart(2, "0")).join("");
// Clip paths need an id per drawing; the icons are rebuilt on every restart.
let clipId = 0;
// Icons drawn on the 96 grid map into the 48 viewBox; stroke widths are in 96 units.
function wideGroup(svg) {
  return svgEl("g", { transform: "scale(.5)", stroke: "none", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
}

const cards = [...document.querySelectorAll(".win")];

// --- Annotations in Figma's look ------------------------------------------------------------------
// Redrawn every frame from the real layout, so every number shown is a measured distance, not a label.
// Orange instead of Figma's red and blue: the annotations belong to the page's own colour of arrival.
// They are drawn once and shown twice: orange outside the glow, background-coloured inside its core, the same
// knockout the text gets. Drawing uses currentColor; the two copies set the colour. Pill text stays black.

const fx = document.getElementById("fx");
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const S = {};
const layer = (op) => svgEl("g", { opacity: clamp(op).toFixed(3) }, S.ann);

function buildFx() {
  fx.innerHTML = "";
  const defs = svgEl("defs", {}, fx);
  const grad = (id, core, rim) => {
    const g = svgEl("radialGradient", { id, gradientUnits: "userSpaceOnUse", cx: -999, cy: -999, r: 0 }, defs);
    svgEl("stop", { offset: 0.45, "stop-color": core }, g);
    svgEl("stop", { offset: 0.75, "stop-color": rim }, g);
    return g;
  };
  S.grads = [grad("gIn", "#fff", "#000"), grad("gOut", "#000", "#fff")];
  for (const [id, g] of [["mIn", "gIn"], ["mOut", "gOut"]]) {
    const m = svgEl("mask", { id, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: "100%", height: "100%" }, defs);
    svgEl("rect", { width: "100%", height: "100%", fill: `url(#${g})` }, m);
  }
  S.ann = svgEl("g", { id: "ann" }, defs);
  svgEl("use", { href: "#ann", mask: "url(#mOut)", style: "color: var(--color-primary)" }, fx);
  svgEl("use", { href: "#ann", mask: "url(#mIn)", style: "color: var(--color-neutral)" }, fx);
}

const pillW = (text) => text.length * 6.1 + 10;
function pill(g, x, y, text) {
  const w = pillW(text);
  svgEl("rect", { x: (x - w / 2).toFixed(1), y: (y - 8).toFixed(1), width: w.toFixed(1), height: 16, rx: 2, fill: "currentColor" }, g);
  svgEl("text", { x: x.toFixed(1), y: (y + 3.5).toFixed(1), "text-anchor": "middle", "font-size": 10, "font-family": MONO, fill: "#000" }, g).textContent = text;
}
const line = (g, x1, y1, x2, y2, extra = {}) => svgEl("line", { x1, y1, x2, y2, stroke: "currentColor", "stroke-width": 1, ...extra }, g);

// A distance between two edges, with end ticks and the value in the middle. When the distance is too short for
// the pill, the pill steps aside instead of covering the letters.
function measureH(g, y, x1, x2, text) {
  if (Math.abs(x2 - x1) < 1) return;
  text ??= String(Math.round(Math.abs(x2 - x1)));
  line(g, x1, y, x2, y);
  line(g, x1, y - 4, x1, y + 4); line(g, x2, y - 4, x2, y + 4);
  Math.abs(x2 - x1) < pillW(text) + 12 ? pill(g, (x1 + x2) / 2, y - 16, text) : pill(g, (x1 + x2) / 2, y, text);
}
function measureV(g, x, y1, y2, text) {
  if (Math.abs(y2 - y1) < 1) return;
  text ??= String(Math.round(Math.abs(y2 - y1)));
  line(g, x, y1, x, y2);
  line(g, x - 4, y1, x + 4, y1); line(g, x - 4, y2, x + 4, y2);
  Math.abs(y2 - y1) < 28 ? pill(g, x + pillW(text) / 2 + 8, (y1 + y2) / 2, text) : pill(g, x, (y1 + y2) / 2, text);
}
// Smart guide: a hairline along the shared edge, with Figma's small crosses where an element touches it.
function guideV(g, x, points) {
  if (!points.length) return;
  const ys = points.flat();
  line(g, x, Math.min(...ys) - 12, x, Math.max(...ys) + 12);
  for (const y of ys) { line(g, x - 3, y - 3, x + 3, y + 3); line(g, x - 3, y + 3, x + 3, y - 3); }
}
// Selection: frame, four handles, size below.
function selection(g, r) {
  svgEl("rect", { x: r.left, y: r.top, width: r.width, height: r.height, fill: "none", stroke: "currentColor", "stroke-width": 1 }, g);
  for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]])
    svgEl("rect", { x: x - 3.5, y: y - 3.5, width: 7, height: 7, fill: "#fff", stroke: "currentColor", "stroke-width": 1 }, g);
  pill(g, r.left + r.width / 2, r.bottom + 16, `${Math.round(r.width)} × ${Math.round(r.height)}`);
}
const box = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t });

// --- Hero · Auto Layout -----------------------------------------------------------------------------
// The glow pushes the hero lines out of line (the lead stays put); they spring back to their slot. A dashed frame marks
// the slot, a redline the offset, a smart guide flashes on the click back. The element under the cursor holds
// still and only its neighbours make room, so an orange phrase can be read while the lines around it give way.

// The push's redlines, quieter than the pills: line and end ticks, with `small` a grey figure beside it.
const QUIET = "var(--color-quiet)";
function quietH(g, y, x1, x2, small) {
  if (Math.abs(x2 - x1) < 1) return;
  line(g, x1, y, x2, y); line(g, x1, y - 3, x1, y + 3); line(g, x2, y - 3, x2, y + 3);
  if (small) svgEl("text", { x: ((x1 + x2) / 2).toFixed(1), y: (y - 5).toFixed(1), "text-anchor": "middle", "font-size": 9, "font-family": MONO, fill: QUIET }, g).textContent = Math.round(Math.abs(x2 - x1));
}
function quietV(g, x, y1, y2, small) {
  if (Math.abs(y2 - y1) < 1) return;
  line(g, x, y1, x, y2); line(g, x - 3, y1, x + 3, y1); line(g, x - 3, y2, x + 3, y2);
  if (small) svgEl("text", { x: (x + 6).toFixed(1), y: ((y1 + y2) / 2 + 3).toFixed(1), "font-size": 9, "font-family": MONO, fill: QUIET }, g).textContent = Math.round(Math.abs(y2 - y1));
}

const Push = {
  init() {
    this.items = [...document.querySelectorAll(".hero h1 .line")].map((el) => ({
      el, x: 0, y: 0, vx: 0, vy: 0, max: 34, peak: 0, flash: 0,
    }));
  },
  update(dt) {
    // The push reaches as far as the glow, and gives way to the calm at the pin.
    const n = dt / 16.7, R = 200 * GS * G.scale;
    for (const it of this.items) {
      const r = it.el.getBoundingClientRect();
      const home = box(r.left - it.x, r.top - it.y, r.right - it.x, r.bottom - it.y);
      let dx = clamp(G.x, home.left, home.right) - G.x, dy = clamp(G.y, home.top, home.bottom) - G.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) { dx = home.left + home.width / 2 - G.x; dy = home.top + home.height / 2 - G.y; }
      const held = pointerIn(home);
      const len = Math.hypot(dx, dy) || 1, f = (touch && !P.press) || reduced || held ? 0 : Math.max(0, 1 - d / R) ** 2 * G.presence * (1 - Calm.k);
      const tx = (dx / len) * it.max * f, ty = (dy / len) * it.max * f * 0.6;
      // A spring toward the target: stiff enough to click back, loose enough to overshoot once.
      it.vx = (it.vx + (tx - it.x) * 0.14 * n) * Math.pow(0.8, n);
      it.vy = (it.vy + (ty - it.y) * 0.14 * n) * Math.pow(0.8, n);
      it.x += it.vx * n; it.y += it.vy * n;
      const off = Math.hypot(it.x, it.y);
      it.el.style.transform = off < 0.05 ? "" : `translate(${it.x.toFixed(2)}px, ${it.y.toFixed(2)}px)`;

      it.peak = Math.max(it.peak, off);
      if (off < 0.8 && it.peak > 6) { it.flash = 1; it.peak = 0; }
      it.flash = Math.max(0, it.flash - dt / 500);

      // Dashed slot, quiet redline with a small grey figure, smart guide on the click back. No pills.
      if (off > 1.5) {
        const L = layer(clamp(off / 6));
        svgEl("rect", { x: home.left, y: home.top, width: home.width, height: home.height, fill: "none", stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "4 3" }, L);
        const c = r.top + r.height / 2;
        if (Math.abs(it.x) > 1.5) quietH(L, c, home.left, r.left, true);
        if (Math.abs(it.y) > 1.5) quietV(L, r.left + Math.min(r.width / 2, 80), home.top, r.top, true);
      }
      if (it.flash > 0) guideV(layer(it.flash), home.left, [[home.top, home.bottom]]);
    }
  },
};

// --- Hero object --------------------------------------------------------------------------------
// Chosen 11.11. from hero-rechts-7.html (V3 Schnitte): a body cut into 28 level contours in the free column right of the
// headline. A rounded square, each slice turned a little further than the one below and sized to a pebble's profile: the
// form is the sum of many small decisions. With a pointer no turn of its own: it leans toward it, slowly (on touch it turns
// slowly about its three axes, 11.11.). The glow acts on it as
// gravity only, its points give way and spring back with the headline's spring; slot, redline and guide stay with the text.
// Turn on touch (11.11.): a turntable, one full turn about the vertical axis in 40 s (radians per ms). The resting tilt
// stays, so the cut slices show as rings, and a slight nod about the horizontal axis (± NOD rad, NOD_MS per swing) keeps
// it reading as a body in space. Three axes at once and a roll about the horizontal axis read too oblique.
const SPIN_RATE = 6.283 / 40000, NOD = 0.12, NOD_MS = 23000;
const Obj = {
  cv: document.getElementById("obj3d"),
  look: { x: 0, y: 0 },
  spin: { y: 0, t: 0 },
  init() {
    this.ctx = this.cv.getContext("2d");
    this.hero = document.querySelector(".hero");
    this.h1 = this.hero.querySelector("h1");
    this.slot = this.hero.querySelector(".obj-slot");
    this.lead = this.hero.querySelector(".lead");
    // The slot's height follows the width (turning the phone), not the height alone: Safari's bars change the height
    // while scrolling, and the hero would jump.
    let lastW = 0;
    const fit = () => { if (innerWidth !== lastW) { lastW = innerWidth; this.fitSlot(); } };
    addEventListener("resize", fit); fit();
    document.fonts?.ready.then(() => this.fitSlot());
    const K = 28, M = 64;
    this.rings = Array.from({ length: K }, (_, k) => {
      const y = lerp(-0.92, 0.92, k / (K - 1)), size = 0.82 * Math.pow(1 - y * y, 0.35), tw = y * 0.9;
      const ring = Array.from({ length: M }, (_, j) => {
        const t = (j / M) * 6.283, c = Math.cos(t), s = Math.sin(t);
        const rr = size / Math.pow(Math.abs(c) ** 4 + Math.abs(s) ** 4, 0.25), x = rr * c, z = rr * s;
        return { x: x * Math.cos(tw) - z * Math.sin(tw), y, z: x * Math.sin(tw) + z * Math.cos(tw), ox: 0, oy: 0, vx: 0, vy: 0, sx: 0, sy: 0, d: 0 };
      });
      return [...ring, ring[0]];
    });
    this.verts = this.rings.flatMap((r) => r.slice(0, -1));
    new ResizeObserver(() => this.size()).observe(this.hero);
    this.recolor();
  },
  // Stacked (under 1020): as much room for the object as the first screen leaves above headline and lead, 160 to 280 px.
  // On the phone (under 744) 15 % less, 136 to 238 px (11.11.).
  fitSlot() {
    this.hero.style.setProperty("--obj-h", "200px");
    if (!this.slot.offsetHeight) return;
    const px = (el, p) => parseFloat(getComputedStyle(el)[p]) || 0;
    const text = this.lead.getBoundingClientRect().bottom - this.h1.getBoundingClientRect().top;
    const used = px(this.hero, "paddingTop") + px(this.slot, "marginTop") + px(this.h1, "marginTop") + text + px(this.lead, "marginTop"); // the lead's margin (s) once more as air at the bottom
    const k = matchMedia("(max-width: 743px)").matches ? 0.85 : 1;
    this.hero.style.setProperty("--obj-h", `${Math.round(clamp(innerHeight - used, 160, 280) * k)}px`);
  },
  size() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = this.hero.offsetWidth; this.h = this.hero.offsetHeight;
    this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr;
  },
  // Grey outside the glow, the background inside it (as the headline's knockout), the middle contour orange and a little
  // transparent. Read from the tokens; a theme change reads them again.
  recolor() {
    const rgb = (name) => {
      this.ctx.fillStyle = cssVar(name);
      const c = this.ctx.fillStyle;
      return c[0] === "#" ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number);
    };
    this.grey = rgb("--color-quiet"); this.paper = rgb("--color-neutral");
    this.orange = `rgba(${rgb("--color-primary").join(",")}, .85)`;
  },
  // How strongly the glow acts at a screen point, and its knockout there: both as on the headline.
  pull(x, y) { return (touch && !P.press) || reduced ? 0 : Math.max(0, 1 - Math.hypot(x - G.x, y - G.y) / (200 * GS * G.scale)) ** 2 * G.presence * (1 - Calm.k); },
  knock(x, y) { const r = GLOW_R * GS * G.presence * G.scale; return r < 1 ? 0 : 1 - clamp((Math.hypot(x - G.x, y - G.y) / r - 0.45) / 0.3); },
  update(dt) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    // Measured on the screen like the glow, drawn relative to the hero: the scroll moves the canvas, not the drawing.
    const hr = this.hero.getBoundingClientRect();
    ctx.translate(-hr.left, -hr.top);
    // The stage, from 1020: the free column right of the longest line, centred on the headline. Should that column be
    // narrower than 200 px (it was from 744 to about 918, before the tablet stacked) the object keeps its form and size
    // and slides over the headline, right-aligned to the content edge, behind the text. Under 1020 (stacked) it fills
    // the slot above the headline, left-aligned with the text (11.11.).
    const hb = this.h1.getBoundingClientRect(), right = innerWidth - parseFloat(getComputedStyle(this.hero).paddingRight);
    let W, cx, cy, R;
    if (this.slot.offsetHeight) {
      const sr = this.slot.getBoundingClientRect();
      W = sr.height; R = W * 0.48; cx = sr.left + R * 1.05; cy = sr.top + W / 2;
    } else {
      const longest = Math.max(...Push.items.map(({ el, x }) => el.getBoundingClientRect().right - x));
      W = Math.max(Math.min(520, right - longest - 48), Math.min(200, right - hb.left));
      cx = right - W / 2; cy = hb.top + hb.height / 2; R = Math.min(W * 0.36, 140);
    }
    if (cy + W < 0 || cy - W > innerHeight) return;
    // Leaning toward the pointer, slowly, within a third of the resting angle. On touch, where nothing points, it turns
    // as a turntable with a slight nod (SPIN_RATE, NOD, 11.11.); a long press lends the finger the pointer's part (see Press).
    const lk = reduced ? 1 : ease(dt, 0.96), L = this.look, S = this.spin;
    L.x = lerp(L.x, P.inside ? clamp((P.x - cx) / (innerWidth * 0.5), -1, 1) : 0, lk);
    L.y = lerp(L.y, P.inside ? clamp((P.y - cy) / (innerHeight * 0.5), -1, 1) : 0, lk);
    if (touch && !reduced) { S.y += dt * SPIN_RATE; S.t += dt; }
    const nod = NOD * Math.sin((S.t / NOD_MS) * 6.283);
    const ay = 0.62 + L.x * 0.3 + S.y, ax = -0.42 + L.y * 0.2 + nod, F = 3.2, n = dt / 16.7;
    const cyA = Math.cos(ay), syA = Math.sin(ay), cxA = Math.cos(ax), sxA = Math.sin(ax);
    for (const v of this.verts) {
      const x1 = v.x * cyA + v.z * syA, z1 = -v.x * syA + v.z * cyA;
      const y2 = v.y * cxA - z1 * sxA, z2 = v.y * sxA + z1 * cxA, s = F / (F + z2);
      v.sx = cx + x1 * s * R; v.sy = cy + y2 * s * R; v.d = clamp(z2, -1, 1);
      // The headline's spring for a point, aimed from where the point sits before its own push.
      const dx = v.sx - G.x, dy = v.sy - G.y, d = Math.hypot(dx, dy) || 1;
      const f = P.inside && Math.hypot(P.x - v.sx, P.y - v.sy) < 4 ? 0 : this.pull(v.sx, v.sy);
      const tx = (dx / d) * 34 * f, ty = (dy / d) * 34 * f * 0.6;
      v.vx = (v.vx + (tx - v.ox) * 0.14 * n) * Math.pow(0.8, n);
      v.vy = (v.vy + (ty - v.oy) * 0.14 * n) * Math.pow(0.8, n);
      v.ox += v.vx * n; v.oy += v.vy * n;
    }
    // Each segment fades with depth and turns to the background under the glow, like the headline's words.
    const g = this.grey, p = this.paper;
    this.rings.forEach((r, k) => {
      ctx.lineWidth = k === 13 ? 1.25 : 1;
      for (let i = 1; i < r.length; i++) {
        const a = r[i - 1], b = r[i], ux = a.sx + a.ox, uy = a.sy + a.oy, wx = b.sx + b.ox, wy = b.sy + b.oy;
        if (k === 13) ctx.strokeStyle = this.orange;
        else {
          const t = this.knock((ux + wx) / 2, (uy + wy) / 2), al = lerp(0.1, 0.9, (1 - (a.d + b.d) / 2) / 2);
          ctx.strokeStyle = `rgba(${Math.round(lerp(g[0], p[0], t))},${Math.round(lerp(g[1], p[1], t))},${Math.round(lerp(g[2], p[2], t))},${al.toFixed(3)})`;
        }
        ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(wx, wy); ctx.stroke();
      }
    });
  },
};

// --- Editor's entries on the orange phrases -------------------------------------------------------
// Every orange phrase carries an entry: what it replaced (struck) and why. Placeholder copy by Claude.
// The number after a struck word says which of the phrase's spans it belongs to (hero: 0 tailored, 1 Product Design).

const ENTRIES = {
  hero: { struck: [["more features", 0], ["a redesign", 0], ["another dashboard", 0], ["pixel-perfect screens", 1]],
    note: "What founders ask for first. What the product needs depends on how its users work." },
  anita: { struck: [["explained to the user", 0], ["covered in onboarding", 0]],
    note: "If a concept needs a manual, it is not finished yet." },
  skills: { struck: [["from the design side", 0]],
    note: "Business to see what it has to earn. Frontend to see what it costs to build." },
};

// Each phrase runs on its own clock: forward while its pin is hovered (plus a short hold, so a slip of the cursor
// does not close it), backward after. The open entry stays while the cursor is on it, so it can be read.
// t = 0..1 feeds the entry style.
const E_DUR = 900, E_HOLD = 300;
// Only the phrases this page has (the orange ones are on the home page).
const phrases = Object.keys(ENTRIES).filter((name) => document.querySelector(`[data-ink="${name}"]`)).map((name) => {
  const spans = [...document.querySelectorAll(`[data-ink="${name}"]`)];
  return { name, spans, entry: ENTRIES[name], head: spans[0].closest("h1, h2"), c: 0, hold: 0 };
});

function updatePhrases(dt) {
  for (const ph of phrases) {
    const rects = ph.spans.map((s) => s.getBoundingClientRect());
    // On touch there is no hover: a tap on the pin opens the entry (see the tap below), it closes once the pin leaves the screen.
    // ph.open is only ever set by a finger's tap, so on a hybrid the finger and the mouse each keep their way.
    if (ph.open) { const r = ph.pin.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) ph.open = false; }
    const over = touch ? !!ph.open : ph.open || pointerIn(ph.pin.getBoundingClientRect(), 4);
    ph.onPin = over;
    ph.over = over || (!touch && ph.c > 0 && pointerIn(ph.card.getBoundingClientRect(), 6));
    ph.hold = ph.over ? E_HOLD : Math.max(0, ph.hold - dt);
    ph.c = reduced ? (ph.hold > 0 ? E_DUR : 0) : clamp(ph.c + (ph.hold > 0 ? dt : -dt * 1.4), 0, E_DUR);
    STYLE.update(ph, ph.c / E_DUR, rects);
  }
}

// The entry's content, built the same in every version.
function entryBody(ph, parent) {
  const head = h("div", "head", null, parent);
  h("span", "av", "S", head);
  h("b", null, "Sören", head);
  h("span", null, "Product Designer", head);
  const ul = h("ul", null, null, parent);
  ph.items = ph.entry.struck.map(([text]) => h("s", "struck", text, h("li", null, null, ul)));
  ph.note = h("p", null, ph.entry.note, parent);
}
// The pen strikes one line after another from `from` on, the reason comes last.
function entryPlay(ph, t, from) {
  ph.items.forEach((el, k) => el.style.setProperty("--s", easeOut(seg(t, from + k * 0.08, from + 0.2 + k * 0.08)).toFixed(3)));
  ph.note.style.opacity = easeOut(seg(t, from + 0.2, from + 0.5)).toFixed(3);
}
// x/y is the point the pin refers to; it grows a little while its entry is open. It never leaves the screen: under about
// 350 px a phrase that fills its line pushes the pin past the edge, there it overlaps the phrase's end instead.
function placePin(pin, x, y, t) {
  x = Math.min(x, document.documentElement.clientWidth - 28);
  pin.style.transform = `translate(${x.toFixed(1)}px, ${(y - 24).toFixed(1)}px) scale(${(1 + 0.2 * snap(seg(t, 0, 0.3))).toFixed(3)})`;
}

// Cursor-Chat. Figma's comment pin marks every orange phrase from the first frame, and the entry rides on the cursor,
// like Figma's cursor chat and like the cup at the contact: the content appears where the eye already is.
const Chat = {
  build(ph) {
    ph.pin = h("div", "pin", "S", document.body);
    ph.card = h("div", "entry chat", null, document.body);
    entryBody(ph, ph.card);
  },
  update(ph, t, rects) {
    const last = rects[rects.length - 1];
    // Anchored to the slot, not to the pushed line, so the pin does not run from the cursor.
    const it = Push.items.find((i) => i.el.contains(ph.spans[ph.spans.length - 1]));
    const ox = it ? it.x : 0, oy = it ? it.y : 0;
    placePin(ph.pin, last.right + 4 - ox, last.top + last.height * 0.18 - oy, t);
    const o = easeOut(seg(t, 0, 0.3));
    ph.card.style.opacity = o.toFixed(3);
    if (!t) return;
    // Follows the cursor while it is on the pin and stays where it was once the cursor moves on, onto the card or away.
    // Flips to the left of the cursor near the right edge.
    // On touch there is no cursor: the entry opens to the left of its pin (the pin always sits at the phrase's right end),
    // right edges aligned, below the pin, above it near the bottom of the screen; it moves with the pin while scrolling.
    // A finger's tap on a hybrid places it the same way, until it has faded out again.
    // Where there is room right of the pin (wide screens, iPad landscape), the entry opens to the right instead, left
    // edges aligned: it then lies beside the phrase's end and does not cover it (11.11.). The phone keeps the left side.
    ph.byTap = ph.open || (ph.byTap && t > 0);
    if (!touch && !ph.byTap) ph.card.classList.remove("left");
    if (touch || ph.byTap) {
      const r = ph.pin.getBoundingClientRect(), w = ph.card.offsetWidth, hgt = ph.card.offsetHeight;
      const right = r.left + w <= innerWidth - 16;
      ph.card.classList.toggle("left", !right);
      ph.at = { x: right ? r.left : Math.max(16, r.right - w), y: r.bottom + 8 + hgt > innerHeight - 16 ? r.top - 8 - hgt : r.bottom + 8 };
    } else if (ph.onPin || !ph.at) ph.at = { x: P.sx + 18 + 260 > innerWidth - 16 ? P.sx - 18 - 260 : P.sx + 18, y: P.sy + 20 };
    ph.card.style.transform = `translate(${ph.at.x.toFixed(1)}px, ${ph.at.y.toFixed(1)}px) scale(${lerp(0.9, 1, o).toFixed(3)})`;
    entryPlay(ph, t, 0.25);
  },
};

const STYLE = Chat;
phrases.forEach((ph) => STYLE.build(ph));

// Touch: a tap on a pin, or slightly beside it, opens its entry and closes the others; a second tap or a tap elsewhere
// closes it, a tap on the open entry keeps it. The pin is 24 px, the tap counts PIN_TAP around it: a 64 px target, above
// Apple's 44 pt and Material's 48 dp. The entry opens leftwards, so its corner sits on the pin's side.
// A finger on a hybrid (touch laptop, iPad with trackpad) taps as on a phone; the mouse there keeps hovering (11.11.).
const PIN_TAP = 20;
let lastPointer = touch ? "touch" : "mouse";
addEventListener("pointerdown", (e) => { lastPointer = e.pointerType; });
if (touch) phrases.forEach((ph) => ph.card.classList.add("left"));
{
  addEventListener("click", (e) => {
    if (Press.eat) { Press.eat = false; return; } // the lift after a long press on the hero
    if (!touch && lastPointer !== "touch") { for (const ph of phrases) ph.open = false; return; }
    const near = (r, m) => r.width > 0 && e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m;
    const tapped = phrases.find((ph) => near(ph.pin.getBoundingClientRect(), PIN_TAP));
    if (!tapped && phrases.some((ph) => ph.open && near(ph.card.getBoundingClientRect(), 0))) return;
    for (const ph of phrases) ph.open = ph === tapped ? !ph.open : false;
  });
}

// --- Calm at the pin --------------------------------------------------------------------------------
// The entry opens on the pin, so the hero has to hold still while it is read. The glow, and the push with it, shrink
// further as the cursor nears a pin; on the pin no push is left. Calm.k runs from 0 (push as usual) to 1 (no push).
// The calm belongs to the pin alone: a short run-up from outside, none at all once the cursor is on a hero line,
// so moving on from the pin to the text sets the push off again.
const PIN_NEAR = 48;
const Calm = { k: 0 };
function updateCalm(dt) {
  const onLine = Push.items.some(({ el, x, y }) => {
    const r = el.getBoundingClientRect();
    return pointerIn(box(r.left - x, r.top - y, r.right - x, r.bottom - y));
  });
  let target = 0;
  if (P.inside && !touch && !onLine) for (const ph of phrases) {
    const r = ph.pin.getBoundingClientRect();
    const d = Math.hypot(P.x - clamp(P.x, r.left, r.right), P.y - clamp(P.y, r.top, r.bottom));
    const onCard = ph.c > 0 && pointerIn(ph.card.getBoundingClientRect(), 6);
    target = Math.max(target, onCard ? 1 : 1 - smoothstep(clamp(d / (PIN_NEAR * GS))));
  }
  Calm.k = reduced ? target : lerp(Calm.k, target, ease(dt, 0.8));
}

// --- Icons, set off by the cursor ------------------------------------------------------------------
// Three ways to make the icons discoverable. Each card has its own clock or progress; the number counts in step.
//   a Puls: a breathing orange dot says "touch me". Hover plays the icon once.
//   b Nähe: a ring around the icon fills as the cursor comes closer; the icon plays along with the distance until
//     it reaches the end.
//   c Entdecken: grey corner brackets frame the unplayed icon. Hover tightens them in orange and plays the icon
//     once; it stays played, the brackets go, and a counter under the row keeps score.
// On touch the icons fall back to the scroll clock of ink.html. Set off once, every icon keeps its end state.

const ICON_DUR = 1400, ICON_GAP = 700, ROW_TOTAL = ICON_DUR + 2 * ICON_GAP;
const rows = [...document.querySelectorAll(".wins")];

function buildIndicator(card, svg) {
  const g = svgEl("g", {}, svg);
  card._ring = svgEl("circle", { cx: 46, cy: 2, r: 3, fill: "none", stroke: "var(--color-primary)", "stroke-width": 1 }, g);
  card._dot = svgEl("circle", { cx: 46, cy: 2, r: 3, fill: "var(--color-primary)", stroke: "none" }, g);
}

function buildIcons() {
  for (const card of cards) {
    const box = card.querySelector(".icon");
    box.innerHTML = "";
    const svg = svgEl("svg", { viewBox: "0 0 48 48" }, box);
    card._upd = ICONS[box.dataset.icon](svg);
    if (!touch) buildIndicator(card, svg);
    iconKnock(svg, KO_RAMP);
    Object.assign(card, { _c: 0, _p: 0, _go: false, _done: false });
    card.classList.remove("won");
    card._upd(0);
  }
}

function iconProgress(card, dt) {
  const r = card.getBoundingClientRect(), hit = pointerIn(r);
  if (hit) card._go = true;
  if (card._go) card._c = reduced ? ICON_DUR : Math.min(ICON_DUR, card._c + dt);
  card._done = card._c === ICON_DUR;
  return card._c / ICON_DUR;
}

function updateIndicator(card, p, t) {
  // The dot breathes while the icon is unplayed and fades as soon as it plays.
  const op = 1 - seg(p, 0, 0.15), beat = (t % 1800) / 1800;
  card._dot.setAttribute("opacity", op.toFixed(3));
  card._ring.setAttribute("r", (3 + 7 * easeOut(beat)).toFixed(2));
  card._ring.setAttribute("opacity", ((1 - beat) * 0.6 * op).toFixed(3));
}

function updateIcons(dt, t) {
  for (const row of rows) {
    const cs = [...row.children];
    if (touch) {
      // Scroll fallback, as in ink.html: one clock per row, cards staggered.
      if (row.getBoundingClientRect().top < innerHeight * 0.8) row._go = true;
      row._r = reduced ? (row._go ? ROW_TOTAL : 0) : clamp((row._r || 0) + (row._go ? dt : 0), 0, ROW_TOTAL);
    }
    cs.forEach((card, i) => {
      const p = touch ? clamp((row._r - i * ICON_GAP) / ICON_DUR) : iconProgress(card, dt), e = smoothstep(p);
      card._upd(p === 1 ? 1 : e);
      // Unplayed, the number shows its real value: nobody who skips the hover should read "0 %".
      card.querySelectorAll(".num").forEach((n) => (n.textContent = p === 0 ? n.dataset.to : Math.round(+n.dataset.to * e)));
      card.classList.toggle("won", p === 1);
      if (!touch) updateIndicator(card, p, t);
    });
  }
}

// --- Contact: coffee or tea ------------------------------------------------------------------------
// The pointer here is a moka pot or a tea bag in place of the system cursor. It sits on the pointer itself, never on
// the eased glow and never drawn away, so the button can be clicked at any moment. The chat button starts secondary
// and fills while it is hovered; what is poured stays, only a change of drink in the toolbar empties it. Full, it is
// the page's primary in orange; from then on the pot or bag is gone and the system's pointer is back. No glow here.
// Coffee: a cream pot with an ink outline. It tips further the nearer it gets, the button is the tipping point; the spout sits
//   on the pointer, so the stream lands right under it. The lid opens only with the real tip and snaps shut when it
//   leaves. In the button the floor is wet almost at once, then a calm level rises; rings run out from the stream.
// Tea, the button as clear water: the bag is dunked, each dip sends a ripple, and the colour spreads from the bag
//   with a soft edge.

const contact = document.getElementById("contact");
const chat = document.getElementById("chat"), cof = chat.querySelector(".cof"), drinkEl = contact.querySelector(".drink");
const LIQUID = RAMP[2], NEAR_BTN = 120;
// Turns a point of the pointer drawing into page coordinates.
const turn = (x, y, a, ox, oy) => { const c = Math.cos(a), s = Math.sin(a); return [ox + x * c - y * s, oy + x * s + y * c]; };

// The Moka Express on its own centre, spout to the left: the upper chamber narrows to the waist, the lower one widens
// to the base, three facets on each. The lid hinges at the handle side.
const POT = {
  upper: "M -9 -16 H 9 L 6 -1 H -6 Z",
  lower: "M -6 1 H 6 L 10 18 H -10 Z",
  sides: ["M -9 -16 H -3 L -2 -1 H -6 Z", "M 3 -16 H 9 L 6 -1 H 2 Z", "M -6 1 H -2 L -3.5 18 H -10 Z", "M 2 1 H 6 L 10 18 H 3.5 Z"],
  facets: "M -3 -16 L -2 -1 M 3 -16 L 2 -1 M -2 1 L -3.5 18 M 2 1 L 3.5 18",
  lid: "M -9.5 -16 Q 0 -19.5 9.5 -16 Z",
  knob: "M -2.2 -17.8 H 2.2 V -21.5 H -2.2 Z",
  spout: "M -8.6 -15 L -14.5 -18 L -7.6 -10 Z",
  handle: "M 8.2 -13.5 L 15 -15 L 13.8 -3.5 L 6.6 -4.5 Z",
  tip: [-14.5, -18], hinge: [9.5, -16],
};
function drawPot(parent, { body, side, handle, line, lw = 0 }) {
  const g = svgEl("g", line ? { stroke: line, "stroke-width": lw, "stroke-linejoin": "round", "stroke-linecap": "round" } : { stroke: "none" }, parent);
  svgEl("path", { d: POT.spout, fill: body }, g);
  svgEl("path", { d: POT.handle, fill: handle }, g);
  for (const d of [POT.upper, POT.lower]) svgEl("path", { d, fill: body }, g);
  for (const d of POT.sides) svgEl("path", { d, fill: side, stroke: "none" }, g);
  if (line) {
    for (const d of [POT.upper, POT.lower]) svgEl("path", { d, fill: "none" }, g);
    svgEl("path", { d: POT.facets, fill: "none", "stroke-width": lw * 0.45 }, g);
  }
  const lid = svgEl("g", {}, g);
  svgEl("path", { d: POT.lid, fill: body }, lid);
  svgEl("path", { d: POT.knob, fill: handle }, lid);
  return { g, lid };
}
// The tea bag on the centre of its bag, string and orange tag above. Paper with an ink outline and a few leaves.
function drawTeaBag(parent) {
  const g = svgEl("g", { stroke: RAMP[0], "stroke-width": 1.3, "stroke-linejoin": "round", "stroke-linecap": "round" }, parent);
  svgEl("path", { d: "M 0 -10 V -24", fill: "none", "stroke-width": 1 }, g);
  svgEl("rect", { x: -5.5, y: -33, width: 11, height: 9, rx: 1.5, fill: RAMP[3] }, g);
  svgEl("path", { d: "M -7.5 -6 L -3 -10 H 3 L 7.5 -6 V 8 Q 7.5 10.5 5 10.5 H -5 Q -7.5 10.5 -7.5 8 Z", fill: "var(--color-tea-paper)" }, g);
  for (const [x, y] of [[-3, -1], [2.5, 1], [-1, 4.5], [3, 6], [-3.5, 7]]) svgEl("circle", { cx: x, cy: y, r: 0.9, fill: RAMP[1], stroke: "none" }, g);
  return g;
}

// The cream pot, as pointer and as tool.
const CREAM_POT = { body: "var(--color-neutral)", side: "var(--color-neutral)", handle: RAMP[0], line: RAMP[0], lw: 1.8 };

// The coffee's surface over N columns, h in px, and the time a full pour takes.
const FLOW = { N: 48, POUR_MS: 1400 };

// The toolbar shows each drink as a plain line glyph in the ink colour, readable on the orange of the chosen tile.
// The detailed pot and bag stay the pointer's.
// The pot: the two chambers, a big handle and a spout so it does not read as an hourglass. The bag: its tag hangs to
// the side on a curved string, so it does not read as a bottle.
const TOOL_ICONS = {
  coffee: ["M6.5 4 H15.5 L13.5 11.5 H8.5 Z", "M8.5 12.5 H13.5 L15.5 21 H6.5 Z", "M6.8 5 L3 4 L7.6 8.6", "M15.2 5.5 H20 L18.6 11 H13.9", "M9.5 4 V2.5 H12.5 V4"],
  tea: ["M4.5 12 L7 9.5 H13 L15.5 12 V20 Q15.5 21 14.5 21 H5.5 Q4.5 21 4.5 20 Z", "M10 9.5 C10 5 13 3 16.5 4.5", "M16.5 2.5 H21 V7.5 H16.5 Z"],
};
drinkEl.querySelectorAll("button").forEach((b) => {
  const svg = svgEl("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.6, "stroke-linejoin": "round", "stroke-linecap": "round" }, b);
  for (const d of TOOL_ICONS[b.dataset.drink]) svgEl("path", { d }, svg);
  b.append(b.title);
  b.addEventListener("click", () => { DRINK = b.dataset.drink; syncDrink(); Cup.build(); });
});
// The chosen drink on the toolbar and the section (the pointer's CSS hangs on it); none until a pick.
function syncDrink() {
  drinkEl.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", o.dataset.drink === DRINK));
  if (DRINK) contact.dataset.drink = drinkEl.dataset.on = DRINK;
  else { delete contact.dataset.drink; delete drinkEl.dataset.on; }
}
syncDrink();

const Cup = {
  build() {
    this.nodes?.forEach((n) => n.remove());
    this.g = svgEl("g", { opacity: 0 }, fx);
    const extra = (el) => (this.nodes.push(el), el);
    this.nodes = [this.g];
    this.stream = this.drops = this.rings = null;
    if (DRINK === "coffee") {
      this.pot = drawPot(this.g, CREAM_POT);
      this.stream = extra(svgEl("path", { fill: "none", stroke: LIQUID, "stroke-width": 4, "stroke-linecap": "round" }, fx));
      this.drops = [0, 1, 2, 3].map(() => extra(svgEl("circle", { r: 1.8, fill: LIQUID, opacity: 0 }, fx)));
    } else if (DRINK === "tea") {
      this.bag = drawTeaBag(svgEl("g", {}, this.g));
      this.rings = [0, 1].map(() => extra(svgEl("circle", { fill: "none", stroke: RAMP[3], "stroke-width": 1.5, opacity: 0 }, fx)));
    }
    // On touch there is no hover: the button is served full.
    Object.assign(this, { op: 0, near: 0, act: 0, lid: 0, ready: 0, fill: touch ? 1 : 0, ox: 0, oy: 0 });
    this.h = new Float32Array(FLOW.N);
    Object.assign(this, { vol: 0, wetL: Infinity, wetR: -Infinity, xl: 0, amp: 0 });
    this.serve();
    this.paint();
  },
  // Full: the button is the primary, the pointer is the system's again (hand on the button, see .served).
  serve() {
    const full = this.fill >= 1;
    chat.classList.toggle("ready", full);
    contact.classList.toggle("served", full);
  },
  // No simulation, a shape that reads as a pour. The wet floor runs out from where the stream lands at
  // 900 px/s, so it is covered within a few frames; above it a calm level rises with what has been poured. Where the
  // stream lands the surface heaps a little and rings run outward; both settle once the pouring stops.
  level(dt, t, pour, at, W, H) {
    const N = FLOW.N, x0 = at * W, grow = 900 * dt / 1000;
    this.vol = clamp(this.vol + pour * dt / FLOW.POUR_MS);
    if (pour > 0) { this.wetL = Math.min(this.wetL, x0); this.wetR = Math.max(this.wetR, x0); this.xl = x0; }
    if (this.wetR >= this.wetL) { this.wetL = Math.max(0, this.wetL - grow); this.wetR = Math.min(W, this.wetR + grow); }
    this.amp = lerp(this.amp, pour > 0 ? 1 : 0, ease(dt, 0.92));
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * W / N;
      if (x < this.wetL || x > this.wetR) { this.h[i] = 0; continue; }
      const d = Math.abs(x - this.xl);
      const edge = (this.wetL <= 0 ? 1 : smoothstep(clamp((x - this.wetL) / 10))) * (this.wetR >= W ? 1 : smoothstep(clamp((this.wetR - x) / 10)));
      const wave = this.amp * (2.5 * Math.exp(-((d / 9) ** 2)) + 1.6 * Math.sin(d * 0.3 - t / 70) * Math.exp(-d / 45));
      this.h[i] = Math.max(0, (Math.max(this.vol * H, 2) + wave) * edge);
    }
    return this.vol;
  },
  // The drink in the button: the pool's surface column by column (coffee) or a soft circle from the bag (tea).
  paint() {
    const f = this.fill, st = cof.style;
    st.maskImage = st.webkitMaskImage = "";
    if (f >= 1) { st.clipPath = "none"; return; }
    if (f <= 0) { st.clipPath = "inset(100% 0 0 0)"; return; }
    const r = chat.getBoundingClientRect();
    if (DRINK === "tea") {
      const R = f * (Math.hypot(r.width, r.height) + 30);
      st.clipPath = "none";
      st.maskImage = st.webkitMaskImage = `radial-gradient(circle at ${this.ox.toFixed(1)}px ${this.oy.toFixed(1)}px, #000 ${Math.max(0, R - 30).toFixed(1)}px, transparent ${R.toFixed(1)}px)`;
      return;
    }
    const N = FLOW.N, y = (i) => `${(100 - this.h[i] / r.height * 100).toFixed(2)}%`, pts = [];
    for (let i = 0; i < N; i++) pts.push(`${((i + 0.5) / N * 100).toFixed(2)}% ${y(i)}`);
    st.clipPath = `polygon(0% 100%, 0% ${y(0)}, ${pts.join(", ")}, 100% ${y(N - 1)}, 100% 100%)`;
  },
  update(dt, t) {
    // No drink picked yet: the system's pointer, the button rests.
    if (!DRINK) return;
    const hit = P.inside ? document.elementFromPoint(P.x, P.y) : null;
    const onSwitch = !!(hit && hit.closest(".drink"));
    const on = !!(hit && hit.closest("#contact")) && !onSwitch && this.fill < 1, onBtn = !touch && !!(hit && hit.closest("#chat"));
    const r = chat.getBoundingClientRect();
    this.op = lerp(this.op, on ? 1 : 0, ease(dt, onSwitch ? 0.5 : 0.7));
    const d = Math.hypot(P.x - clamp(P.x, r.left, r.right), P.y - clamp(P.y, r.top, r.bottom));
    this.near = lerp(this.near, on ? clamp(1 - d / NEAR_BTN) : 0, ease(dt, 0.8));
    // Works while the button is hovered and not yet full, and rests once it is.
    this.act = lerp(this.act, onBtn && this.fill < 1 ? 1 : 0, ease(dt, 0.85));
    // What is poured stays. Tea draws on a clock; coffee counts what the pool holds (see the coffee branch below).
    if (reduced && onBtn) this.fill = 1;
    else if (!touch && DRINK === "tea") this.fill = clamp(this.fill + (onBtn ? dt / 1625 : 0));
    // Full: the pointer fades and shrinks away, the system's pointer takes over.
    this.serve();
    this.ready = reduced ? +(this.fill >= 1) : lerp(this.ready, this.fill >= 1 ? 1 : 0, ease(dt, 0.6));
    // The tea spreads from the middle of the bag, which hangs just below the pointer.
    if (onBtn && this.fill < 1) { this.ox = P.x - r.left; this.oy = P.y + 2 - r.top; }

    let x = P.x, y = P.y, a = 0, lift = 0;
    if (DRINK === "coffee") {
      // One continuous tip, no step at the edge: the closer to the button, the further it leans, and at the edge it
      // stands just short of the pour. The button is the tipping point; the last few degrees there make it run over.
      // As it tips it slides until the spout sits on the pointer, so the stream lands right under it. The lid opens
      // back over the handle with the real tip and snaps shut, with a small bounce, when the pot leaves.
      const k = 0.8 * smoothstep(this.near) + 0.2 * this.act;
      a = -1.02 * k;
      const [tx, ty] = turn(POT.tip[0], POT.tip[1], a, 0, 0);
      x -= (tx - 3) * k; y -= ty * k;
      const pour = seg(this.act, 0.1, 0.5), at = clamp((P.x - r.left) / r.width), col = Math.min(FLOW.N - 1, Math.floor(at * FLOW.N));
      if (!touch && !(reduced && onBtn) && this.fill < 1) {
        this.fill = this.level(dt, t, onBtn ? pour : 0, at, r.width, r.height);
        if (this.fill >= 0.97) this.fill = 1;
      }
      const [sx, sy] = turn(POT.tip[0], POT.tip[1], a, x, y), ey = Math.max(sy + 4, r.bottom - this.h[col]);
      this.stream.setAttribute("d", `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${(sx - 3).toFixed(1)} ${(sy + 5).toFixed(1)} ${(sx - 3).toFixed(1)} ${ey.toFixed(1)}`);
      this.stream.setAttribute("opacity", pour.toFixed(3));
      // The lid stays shut through the first lean and opens over the last stretch before the edge.
      this.lid = lerp(this.lid, seg(k, 0.5, 0.85), ease(dt, 0.9));
      const [hx, hy] = POT.hinge;
      this.pot.lid.setAttribute("transform", `rotate(${(95 * easeOutBack(clamp(this.lid))).toFixed(1)} ${hx} ${hy})`);
      this.drops.forEach((dr, i) => {
        const k = ((t / 420) + i / 4) % 1, side = i % 2 ? 1 : -1;
        dr.setAttribute("cx", (sx - 3 + side * (3 + 9 * k)).toFixed(1));
        dr.setAttribute("cy", (ey - 9 * k + 14 * k * k).toFixed(1));
        dr.setAttribute("opacity", ((1 - k) * pour).toFixed(3));
      });
    } else {
      // Dunked: the bag lifts by its string and drops back, a ripple goes out on each dip. A few pixels only, the
      // pointer stays on the button.
      const beat = (t / 650) % 1;
      lift = reduced ? 0 : -5 * this.act * Math.sin(Math.PI * beat);
      this.rings.forEach((rg, i) => {
        const k = (beat + i / 2) % 1;
        rg.setAttribute("cx", x.toFixed(1)); rg.setAttribute("cy", (y + 10).toFixed(1));
        rg.setAttribute("r", (3 + 16 * k).toFixed(1));
        rg.setAttribute("opacity", ((1 - k) * this.act * 0.8).toFixed(3));
      });
    }
    this.g.setAttribute("transform", `translate(${x.toFixed(1)} ${(y + lift).toFixed(1)}) rotate(${(a * 57.3).toFixed(1)}) scale(${(1 - 0.4 * this.ready).toFixed(3)})`);
    this.g.setAttribute("opacity", (this.op * (1 - this.ready)).toFixed(3));
    this.paint();
  },
};

// --- Run ----------------------------------------------------------------------------------------

function start() {
  buildFx();
  buildIcons();
  document.querySelectorAll(".num").forEach((n) => (n.textContent = n.dataset.to));
  rows.forEach((r) => Object.assign(r, { _r: 0, _go: false }));
  phrases.forEach((ph) => { ph.c = 0; ph.hold = 0; });
  DRINK = null; syncDrink();
  Cup.build();
}
// A theme change (dark mode, 10.11.): the colours JS holds as values are read again from the variables, and what was
// drawn with them is drawn again. The icons start unplayed, like after a restart.
function retheme() {
  RAMP.splice(0, RAMP.length, ...RAMP_VARS.map(cssVar));
  CREAM_POT.handle = CREAM_POT.line = RAMP[0];
  readKnockColors();
  setKoFilters();
  buildIcons();
  Cup.build();
  if (PAGE === "home") Obj.recolor();
}
// One switch, light or dark; the choice is kept (localStorage "theme"). Without a choice the page follows the system, also
// when the system changes while the page is open.
const themeBtn = document.querySelector(".theme"), systemDark = matchMedia("(prefers-color-scheme: dark)");
// Its place (11.11.): below the 744 anchor the last item in the navbar, from it its own glass. One button moved, not two,
// so its state and focus stay one.
const navEl = document.querySelector(".nav"), themebar = document.querySelector(".themebar"), phone = matchMedia("(max-width: 743px)");
// The bar is centred and as wide as its content, so the margin beside it runs down first by itself. Once it would pass
// --side the space between the items gives way (--g, from navbar-gap − 2 × --nav-px down to 0); the hit areas and the
// switch's separation stay. Below 0 it would overflow: 320 px is reviewed after the launch.
function fitNav() {
  navEl.style.removeProperty("--g");
  const cs = getComputedStyle(navEl), g = parseFloat(cs.columnGap), gaps = navEl.children.length - 1;
  const room = innerWidth - 2 * parseFloat(getComputedStyle(themebar).right); // --side resolved: the glass stands at right: var(--side)
  const over = navEl.offsetWidth - room;
  if (over > 0) navEl.style.setProperty("--g", `${Math.max(0, g - over / gaps)}px`);
}
function placeSwitch() { (phone.matches ? navEl : themebar).append(themeBtn); fitNav(); }
placeSwitch();
phone.addEventListener("change", placeSwitch);
addEventListener("resize", fitNav);
document.fonts.ready.then(fitNav);
function setTheme(t, keep) {
  document.documentElement.dataset.theme = t;
  themeBtn.setAttribute("aria-pressed", String(t === "dark"));
  if (keep) try { localStorage.setItem("theme", t); } catch {}
  retheme();
}
themeBtn.setAttribute("aria-pressed", String(document.documentElement.dataset.theme === "dark"));
themeBtn.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));
systemDark.addEventListener("change", (e) => {
  let t = null;
  try { t = localStorage.getItem("theme"); } catch {}
  if (!t) setTheme(e.matches ? "dark" : "light");
});
Push.init();
if (PAGE === "home") Obj.init();

// ?present: for captures, shared links and user tests; the key r does nothing then.
if (q.has("present")) document.documentElement.classList.add("present");

// Key r restarts, not under ?present: nobody in a test should set it off.
addEventListener("keydown", (e) => {
  // Typing in a dev control must not set off the shortcut.
  if (e.target.closest?.("input, select, button") || document.documentElement.classList.contains("present")) return;
  if (e.key === "r") { scrollTo({ top: 0, behavior: "instant" }); start(); }
});

// --- Logos and testimonials -----------------------------------------------------------------------

// The second logo set is a hidden copy, so the row can loop without a seam.
if (PAGE === "home") {
  const logoSet = document.querySelector(".logos-set");
  const logoCopy = logoSet.cloneNode(true);
  logoCopy.setAttribute("aria-hidden", "true");
  logoCopy.querySelectorAll("img").forEach((img) => (img.alt = ""));
  logoSet.after(logoCopy);

  const quotes = [...document.querySelectorAll(".quote")];
  let quoteIdx = 0;
  document.getElementById("nextQuote").addEventListener("click", () => {
    quotes[quoteIdx].classList.remove("is-on");
    quoteIdx = (quoteIdx + 1) % quotes.length;
    quotes[quoteIdx].classList.add("is-on");
  });
}

// On a case page every part of the case (head, chapter, showcase, quote) counts as a section of its own.
const sections = [...document.querySelectorAll("section")].filter((s) => getComputedStyle(s).display !== "none")
  .flatMap((s) => (s.id === "case" ? [...s.children] : [s]));
document.querySelector(".ticks").innerHTML = "<i></i>".repeat(sections.length);
const tickEls = [...document.querySelectorAll(".ticks i")];
let prev = performance.now();

function frame(t) {
  const dt = Math.min(50, t - prev); prev = t;
  const k = reduced ? 1 : ease(dt, 0.82);
  P.sx = lerp(P.sx, P.x, k); P.sy = lerp(P.sy, P.y, k);
  P.presence = lerp(P.presence, P.inside ? 1 : 0, ease(dt, 0.88));
  // The section whose top has passed the middle of the screen; at the end of the page the last one, which is too short to get there.
  const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
  const active = atEnd ? sections.length - 1 : Math.max(0, sections.findLastIndex((s) => s.getBoundingClientRect().top <= innerHeight / 2));
  tickEls.forEach((el, i) => el.classList.toggle("on", i === active));

  if (PAGE === "home") updateCalm(dt);
  updateGlow(dt);
  S.ann.replaceChildren();
  // The hero push, the editor's pins (and their calm, above) and the icons live on the home sections; hidden, they
  // would measure nothing.
  if (PAGE === "home") { Push.update(dt); Obj.update(dt); updatePhrases(dt); }
  updateKnock();
  if (PAGE === "home") updateIcons(dt, t);
  Cup.update(dt, t);

  requestAnimationFrame(frame);
}

// --- Type ---------------------------------------------------------------------------------------
// Families, weights and sizes are tokens: set in design.md, loaded through tokens.css, tuned in the kit panel.
// Writes one URL parameter, reading the URL at the moment of writing.
function setParam(param, value) {
  const url = new URL(location.href);
  if (value) url.searchParams.set(param, value); else url.searchParams.delete(param);
  history.replaceState(null, "", url);
}

// --- Case strikes ---------------------------------------------------------------------------------
// An inline element reports one box per line, so each line of a struck text gets its own stroke, whatever the wrap.
// Placed again whenever a struck text changes size (window, tokens in the kit, fonts arriving). Sizes in em of the text:
// width max(2px, .07), past the words .08, rise .04, sag .05; drawn in pixels, so the round ends stay round at any length.
function placeStrokes() {
  for (const pen of document.querySelectorAll(".was .pen")) {
    const was = pen.parentElement, o = was.getBoundingClientRect(), fs = parseFloat(getComputedStyle(was).fontSize);
    const t = Math.max(2, 0.07 * fs), past = 0.08 * fs, rise = 0.04 * fs, sag = 0.05 * fs;
    was.querySelectorAll(".stroke").forEach((s) => s.remove());
    // In a knocked headline the words are spans and report a box each: boxes on the same line become one.
    const lines = [];
    for (const b of pen.getClientRects()) {
      const l = lines.find((r) => Math.abs(r.top - b.top) < b.height / 2);
      if (l) { l.left = Math.min(l.left, b.left); l.right = Math.max(l.right, b.right); } else lines.push({ left: b.left, right: b.right, top: b.top, height: b.height });
    }
    for (const r of lines.map((l) => ({ ...l, width: l.right - l.left }))) {
      const s = h("i", "stroke", null, was);
      s.setAttribute("aria-hidden", "true");
      s.style.cssText = `left: ${(r.left - o.left).toFixed(1)}px; top: ${(r.top - o.top).toFixed(1)}px; width: ${r.width.toFixed(1)}px; height: ${r.height.toFixed(1)}px`;
      const y = 0.43 * r.height, f = (n) => n.toFixed(1);
      const svg = svgEl("svg", { width: f(r.width), height: f(r.height) }, s);
      svgEl("path", { d: `M ${f(-past)} ${f(y)} Q ${f(r.width / 2)} ${f(y + sag)} ${f(r.width + past)} ${f(y - rise)}`,
        fill: "none", stroke: "var(--color-primary)", "stroke-width": f(t), "stroke-linecap": "round" }, svg);
    }
  }
}
const strokeWatch = new ResizeObserver(placeStrokes);

// --- Nav links ------------------------------------------------------------------------------------
// The pages are real links now. The current one is marked in the markup (aria-current) and takes you to the top.
document.querySelectorAll(".nav a[aria-current]").forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  scrollTo({ top: 0, behavior: "smooth" });
}));
document.querySelectorAll('.project[href="#"], .cpage .btn[href="#"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

document.fonts.ready.then(() => {
  start();
  document.querySelectorAll(".was").forEach((el) => strokeWatch.observe(el));
  requestAnimationFrame(frame);
  document.documentElement.dataset.ready = "1";
  requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.live = "1"; }));
});
