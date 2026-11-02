// Render .pptx → gambar per slide. Mendukung: ukuran slide, latar (warna/gradasi/gambar), tema warna & font, bentuk dasar
// (kotak, kotak bulat, elips, segitiga, belah ketupat, garis/konektor), isi & garis, teks berformat dengan pewarisan
// placeholder (layout & master), bullet/nomor, gambar (+crop), grup, tabel. Grafik/SmartArt diganti kotak keterangan.

import JSZip from "jszip";
import {
  EMU_PT, attr, child, childEls, cssFamily, defaultParaFmt, defaultStyle, descendants, emitLine, hexColor, hslAdjust,
  layoutParagraph, loadImageFromBytes, mimeForExt, paraHeight, parseXml, tintShadeLinear,
  type Img, type Inline, type Op, type ParaFmt, type RasterDoc, type RasterPage, type RunStyle,
} from "./core";

type Xf = { sx: number; sy: number; tx: number; ty: number };
const ID: Xf = { sx: 1, sy: 1, tx: 0, ty: 0 };
const n = (v: string | null | undefined, d = 0) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? d : Number(v));

interface PartCtx {
  doc: Document;
  rels: Map<string, string>; // rId → path absolut di zip
  kind: "slide" | "layout" | "master";
}

export async function renderPptx(file: File): Promise<RasterDoc> {
  const zip = await JSZip.loadAsync(file);
  const presXml = await zip.file("ppt/presentation.xml")?.async("text");
  if (!presXml) throw new Error("Bukan file .pptx yang valid (ppt/presentation.xml tidak ditemukan).");
  const pres = parseXml(presXml);
  const notes: string[] = [];
  const sz = descendants(pres, "sldSz")[0];
  const SW = n(attr(sz, "cx"), 9144000) * EMU_PT;
  const SH = n(attr(sz, "cy"), 6858000) * EMU_PT;

  const readRels = async (partPath: string): Promise<Map<string, string>> => {
    const dir = partPath.split("/").slice(0, -1).join("/");
    const relPath = `${dir}/_rels/${partPath.split("/").pop()}.rels`;
    const out = new Map<string, string>();
    const xml = await zip.file(relPath)?.async("text");
    if (!xml) return out;
    for (const r of descendants(parseXml(xml), "Relationship")) {
      let t = r.getAttribute("Target") || "";
      if (r.getAttribute("TargetMode") === "External") continue;
      if (t.startsWith("/")) t = t.slice(1);
      else {
        const parts = dir.split("/");
        for (const seg of t.split("/")) {
          if (seg === "..") parts.pop();
          else if (seg !== ".") parts.push(seg);
        }
        t = parts.join("/");
      }
      out.set(r.getAttribute("Id") || "", t);
    }
    return out;
  };
  const loadPart = async (path: string, kind: PartCtx["kind"]): Promise<PartCtx | null> => {
    const xml = await zip.file(path)?.async("text");
    if (!xml) return null;
    return { doc: parseXml(xml), rels: await readRels(path), kind };
  };

  // ── tema ──
  const themeColors = new Map<string, string>();
  let majorFont = "Calibri Light", minorFont = "Calibri";
  const themePath = zip.file(/^ppt\/theme\/theme1\.xml$/)[0]?.name;
  if (themePath) {
    const th = parseXml(await zip.file(themePath)!.async("text"));
    const cs = descendants(th, "clrScheme")[0];
    for (const c of Array.from(cs?.children ?? [])) {
      const v = c.firstElementChild;
      const hex = v ? attr(v, "val") ?? attr(v, "lastClr") : null;
      const last = v ? attr(v, "lastClr") : null;
      themeColors.set(c.localName, hexColor(v?.localName === "sysClr" ? last : hex, "#000000"));
    }
    majorFont = attr(child(descendants(th, "majorFont")[0], "latin"), "typeface") || majorFont;
    minorFont = attr(child(descendants(th, "minorFont")[0], "latin"), "typeface") || minorFont;
  }

  // master utama (dipakai untuk clrMap & txStyles)
  const masterPaths = zip.file(/^ppt\/slideMasters\/slideMaster\d+\.xml$/).map((f) => f.name);
  const masterCache = new Map<string, PartCtx>();
  const getMaster = async (p: string) => {
    if (!masterCache.has(p)) { const m = await loadPart(p, "master"); if (m) masterCache.set(p, m); }
    return masterCache.get(p) ?? null;
  };
  const defaultTextStyle = descendants(pres, "defaultTextStyle")[0] ?? null;

  const clrMapOf = (master: PartCtx | null): Record<string, string> => {
    const m: Record<string, string> = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };
    const el = master ? descendants(master.doc, "clrMap")[0] : null;
    if (el) for (const a of Array.from(el.attributes)) m[a.localName] = a.value;
    return m;
  };

  // ── warna ──
  interface Clr { hex: string; alpha: number }
  const resolveClr = (holder: Element | null | undefined, clrMap: Record<string, string>, phClr?: string): Clr | null => {
    if (!holder) return null;
    const el = ["srgbClr", "schemeClr", "sysClr", "prstClr", "hslClr", "scrgbClr"].map((k) => child(holder, k)).find(Boolean) ?? null;
    if (!el) return null;
    let hex = "#000000";
    if (el.localName === "srgbClr") hex = hexColor(attr(el, "val"), "#000000");
    else if (el.localName === "sysClr") hex = hexColor(attr(el, "lastClr"), attr(el, "val") === "window" ? "#ffffff" : "#000000");
    else if (el.localName === "prstClr") hex = ({ black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", yellow: "#ffff00", gray: "#808080" } as Record<string, string>)[attr(el, "val") || ""] ?? "#000000";
    else if (el.localName === "schemeClr") {
      const v = attr(el, "val") || "tx1";
      if (v === "phClr") hex = phClr ?? "#000000";
      else hex = themeColors.get(clrMap[v] ?? v) ?? themeColors.get(v) ?? "#000000";
    }
    let alpha = 1;
    let lumMod = 1, lumOff = 0;
    for (const m of Array.from(el.children)) {
      const val = n(attr(m, "val"));
      if (m.localName === "lumMod") lumMod = val / 100000;
      else if (m.localName === "lumOff") lumOff = val / 100000;
      else if (m.localName === "alpha") alpha = val / 100000;
      else if (m.localName === "tint") hex = tintShadeLinear(hex, "tint", val / 100000);
      else if (m.localName === "shade") hex = tintShadeLinear(hex, "shade", val / 100000);
    }
    if (lumMod !== 1 || lumOff !== 0) hex = hslAdjust(hex, lumMod, lumOff);
    return { hex, alpha };
  };
  const css = (c: Clr | null): string | undefined => {
    if (!c) return undefined;
    if (c.alpha >= 0.999) return c.hex;
    const m = /^#(..)(..)(..)$/.exec(c.hex)!;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${c.alpha})`;
  };

  const fontFor = (face?: string | null) => {
    if (!face) return minorFont;
    if (face === "+mj-lt") return majorFont;
    if (face === "+mn-lt") return minorFont;
    return face;
  };

  const imageCache = new Map<string, Img | null>();
  const getImage = async (path: string | undefined): Promise<Img | null> => {
    if (!path) return null;
    if (imageCache.has(path)) return imageCache.get(path)!;
    const f = zip.file(path);
    const img = f ? await loadImageFromBytes(await f.async("uint8array"), mimeForExt(path)) : null;
    imageCache.set(path, img);
    return img;
  };

  // ── pewarisan teks ──
  const lvlOf = (lst: Element | null | undefined, lvl: number) => child(lst, `lvl${lvl + 1}pPr`);
  const masterTx = (master: PartCtx | null, which: "titleStyle" | "bodyStyle" | "otherStyle") => child(descendants(master?.doc, "txStyles")[0] ?? null, which);

  interface LvlProps { pPr: Element[]; defRPr: Element[] }
  const mergeLvl = (chain: (Element | null)[], lvl: number): LvlProps => {
    const pPr: Element[] = [];
    const defRPr: Element[] = [];
    for (const lst of chain) {
      const l = lvlOf(lst, lvl);
      if (l) {
        pPr.push(l);
        const d = child(l, "defRPr");
        if (d) defRPr.push(d);
      }
    }
    return { pPr, defRPr };
  };
  const pAttr = (lp: LvlProps, name: string): string | null => {
    for (let i = lp.pPr.length - 1; i >= 0; i--) { const v = lp.pPr[i].getAttribute(name); if (v !== null) return v; }
    return null;
  };
  const pChild = (lp: LvlProps, name: string): Element | null => {
    for (let i = lp.pPr.length - 1; i >= 0; i--) { const c = child(lp.pPr[i], name); if (c) return c; }
    return null;
  };

  // ── bentuk ──
  const getXfrm = (spPr: Element | null) => {
    const x = child(spPr, "xfrm");
    if (!x) return null;
    const off = child(x, "off"), ext = child(x, "ext");
    return { x: n(attr(off, "x")) * EMU_PT, y: n(attr(off, "y")) * EMU_PT, w: n(attr(ext, "cx")) * EMU_PT, h: n(attr(ext, "cy")) * EMU_PT, rot: n(attr(x, "rot")) / 60000, flipH: attr(x, "flipH") === "1", flipV: attr(x, "flipV") === "1" };
  };
  const applyXf = (b: { x: number; y: number; w: number; h: number }, xf: Xf) => ({ x: b.x * xf.sx + xf.tx, y: b.y * xf.sy + xf.ty, w: b.w * xf.sx, h: b.h * xf.sy });

  interface Ctx {
    part: PartCtx;
    clrMap: Record<string, string>;
    layout: PartCtx | null;
    master: PartCtx | null;
    slideMasterTx: { title: Element | null; body: Element | null; other: Element | null };
    skipPlaceholders: boolean;
  }

  const phInfo = (sp: Element) => {
    const ph = child(child(child(sp, "nvSpPr") ?? child(sp, "nvPicPr") ?? child(sp, "nvGraphicFramePr"), "nvPr"), "ph");
    return ph ? { type: attr(ph, "type") || "body", idx: attr(ph, "idx") } : null;
  };
  const findPlaceholder = (part: PartCtx | null, ph: { type: string; idx: string | null }): Element | null => {
    if (!part) return null;
    const tree = descendants(part.doc, "spTree")[0];
    const cands = childEls(tree, "sp");
    const norm = (t: string) => (t === "ctrTitle" ? "title" : t === "subTitle" ? "body" : t);
    let byIdx: Element | null = null, byType: Element | null = null;
    for (const sp of cands) {
      const p = phInfo(sp);
      if (!p) continue;
      if (ph.idx && p.idx === ph.idx && !byIdx) byIdx = sp;
      if (norm(p.type) === norm(ph.type) && !byType) byType = sp;
    }
    return byIdx ?? byType;
  };

  async function renderTree(tree: Element, ctx: Ctx, ops: Op[], xf: Xf) {
    for (const el of Array.from(tree.children)) {
      const ln = el.localName;
      if (ln === "sp") await renderSp(el, ctx, ops, xf);
      else if (ln === "pic") await renderPic(el, ctx, ops, xf);
      else if (ln === "cxnSp") renderCxn(el, ctx, ops, xf);
      else if (ln === "grpSp") {
        const gx = child(child(el, "grpSpPr"), "xfrm");
        if (gx) {
          const off = child(gx, "off"), ext = child(gx, "ext"), cho = child(gx, "chOff"), che = child(gx, "chExt");
          const ox = n(attr(off, "x")) * EMU_PT, oy = n(attr(off, "y")) * EMU_PT, ow = n(attr(ext, "cx")) * EMU_PT, oh = n(attr(ext, "cy")) * EMU_PT;
          const cx0 = n(attr(cho, "x")) * EMU_PT, cy0 = n(attr(cho, "y")) * EMU_PT, cw = n(attr(che, "cx")) * EMU_PT || ow, ch = n(attr(che, "cy")) * EMU_PT || oh;
          const gsx = cw ? ow / cw : 1, gsy = ch ? oh / ch : 1;
          // pemetaan anak → induk, lalu diterapkan xf induk
          const local: Xf = { sx: gsx, sy: gsy, tx: ox - cx0 * gsx, ty: oy - cy0 * gsy };
          const comp: Xf = { sx: local.sx * xf.sx, sy: local.sy * xf.sy, tx: local.tx * xf.sx + xf.tx, ty: local.ty * xf.sy + xf.ty };
          await renderTree(el, ctx, ops, comp);
        } else await renderTree(el, ctx, ops, xf);
      } else if (ln === "graphicFrame") await renderFrame(el, ctx, ops, xf);
      else if (ln === "AlternateContent") {
        const choice = child(el, "Choice") ?? child(el, "Fallback");
        if (choice) await renderTree(choice, ctx, ops, xf);
      }
    }
  }

  const geomOf = (spPr: Element | null) => attr(child(spPr, "prstGeom"), "prst") || (child(spPr, "custGeom") ? "cust" : "rect");

  function fillOf(spPr: Element | null, style: Element | null, ctx: Ctx): { fill?: string; image?: boolean; none?: boolean } {
    if (spPr) {
      if (child(spPr, "noFill")) return { none: true };
      const sf = child(spPr, "solidFill");
      if (sf) return { fill: css(resolveClr(sf, ctx.clrMap)) };
      const gf = child(spPr, "gradFill");
      if (gf) {
        const stops = descendants(gf, "gs");
        const a = resolveClr(stops[0], ctx.clrMap), b = resolveClr(stops[stops.length - 1], ctx.clrMap);
        if (a && b) return { fill: css(a.alpha === 1 && b.alpha === 1 ? { hex: hslAdjust(a.hex, 1, 0), alpha: 1 } : a) , };
        return { fill: css(a) };
      }
      const pf = child(spPr, "pattFill");
      if (pf) return { fill: css(resolveClr(child(pf, "fgClr"), ctx.clrMap)) };
      if (child(spPr, "blipFill")) return { image: true };
    }
    const fr = child(style, "fillRef");
    if (fr && n(attr(fr, "idx")) > 0) return { fill: css(resolveClr(fr, ctx.clrMap)) };
    return { none: true };
  }
  function lineOf(spPr: Element | null, style: Element | null, ctx: Ctx): { color: string; w: number; dash?: number[] } | null {
    const ln = child(spPr, "ln");
    if (ln) {
      if (child(ln, "noFill")) return null;
      const sf = child(ln, "solidFill");
      const w = Math.max(0.5, n(attr(ln, "w"), 12700) * EMU_PT);
      const dash = attr(child(ln, "prstDash"), "val");
      const d = dash && dash !== "solid" ? (dash === "sysDot" || dash === "dot" ? [w, w * 2] : [w * 4, w * 2]) : undefined;
      if (sf) return { color: css(resolveClr(sf, ctx.clrMap)) || "#000000", w, dash: d };
      const lr = child(style, "lnRef");
      if (lr && n(attr(lr, "idx")) > 0) return { color: css(resolveClr(lr, ctx.clrMap)) || "#000000", w, dash: d };
      return null;
    }
    const lr = child(style, "lnRef");
    if (lr && n(attr(lr, "idx")) > 0) return { color: css(resolveClr(lr, ctx.clrMap)) || "#000000", w: 1 };
    return null;
  }

  function shapeOps(geom: string, b: { x: number; y: number; w: number; h: number }, fill: string | undefined, ln: { color: string; w: number; dash?: number[] } | null, spPr: Element | null, flip: { h: boolean; v: boolean }): Op[] {
    const stroke = ln?.color, lw = ln?.w;
    const { x, y, w, h } = b;
    if (geom === "ellipse") return [{ t: "ellipse", x, y, w, h, fill, stroke, lw }];
    if (geom === "roundRect") {
      const adj = n(attr(descendants(spPr, "gd")[0] ?? null, "fmla")?.replace("val ", ""), 16667) / 100000;
      return [{ t: "rect", x, y, w, h, fill, stroke, lw, r: Math.min(w, h) * adj }];
    }
    const poly = (pts: [number, number][]): Op[] => [{ t: "poly", pts, fill, stroke, lw }];
    if (geom === "triangle") return poly([[x + w / 2, y], [x + w, y + h], [x, y + h]]);
    if (geom === "rtTriangle") return poly([[x, y], [x + w, y + h], [x, y + h]]);
    if (geom === "diamond") return poly([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]);
    if (geom === "parallelogram") return poly([[x + w * 0.25, y], [x + w, y], [x + w * 0.75, y + h], [x, y + h]]);
    if (geom === "hexagon") return poly([[x + w * 0.25, y], [x + w * 0.75, y], [x + w, y + h / 2], [x + w * 0.75, y + h], [x + w * 0.25, y + h], [x, y + h / 2]]);
    if (geom === "rightArrow") return poly([[x, y + h * 0.25], [x + w * 0.6, y + h * 0.25], [x + w * 0.6, y], [x + w, y + h / 2], [x + w * 0.6, y + h], [x + w * 0.6, y + h * 0.75], [x, y + h * 0.75]]);
    if (geom === "leftArrow") return poly([[x + w, y + h * 0.25], [x + w * 0.4, y + h * 0.25], [x + w * 0.4, y], [x, y + h / 2], [x + w * 0.4, y + h], [x + w * 0.4, y + h * 0.75], [x + w, y + h * 0.75]]);
    if (geom === "line" || geom === "straightConnector1") {
      return [{ t: "line", x1: flip.h ? x + w : x, y1: flip.v ? y + h : y, x2: flip.h ? x : x + w, y2: flip.v ? y : y + h, color: stroke || fill || "#000000", lw: lw || 1, dash: ln?.dash }];
    }
    if (geom === "cust") {
      const path = descendants(spPr, "path")[0];
      if (path) {
        const pw = n(attr(path, "w")) || 1, ph = n(attr(path, "h")) || 1;
        const pts: [number, number][] = [];
        for (const seg of Array.from(path.children)) {
          for (const p of descendants(seg, "pt")) pts.push([x + (n(attr(p, "x")) / pw) * w, y + (n(attr(p, "y")) / ph) * h]);
        }
        if (pts.length >= 2) return poly(pts);
      }
    }
    return [{ t: "rect", x, y, w, h, fill, stroke, lw }];
  }

  const wrapRot = (ops: Op[], rot: number, b: { x: number; y: number; w: number; h: number }): Op[] =>
    rot ? [{ t: "group", rot, cx: b.x + b.w / 2, cy: b.y + b.h / 2, ops }] : ops;

  async function renderSp(sp: Element, ctx: Ctx, ops: Op[], xf: Xf) {
    const ph = phInfo(sp);
    if (ph && ctx.skipPlaceholders) return;
    const spPr = child(sp, "spPr");
    const style = child(sp, "style");
    let xfrm = getXfrm(spPr);
    let layoutPh: Element | null = null, masterPh: Element | null = null;
    if (ph && ctx.part.kind === "slide") {
      layoutPh = findPlaceholder(ctx.layout, ph);
      masterPh = findPlaceholder(ctx.master, ph);
    } else if (ph && ctx.part.kind === "layout") masterPh = findPlaceholder(ctx.master, ph);
    if (!xfrm) xfrm = getXfrm(child(layoutPh, "spPr")) ?? getXfrm(child(masterPh, "spPr"));
    if (!xfrm) return;
    const b = applyXf(xfrm, xf);
    const geom = geomOf(spPr ?? child(layoutPh, "spPr") ?? null);
    const fl = fillOf(spPr, style, ctx);
    const ln = lineOf(spPr, style, ctx);
    const shapeList: Op[] = [];
    if (fl.image) {
      const bf = child(spPr, "blipFill");
      const rid = attr(child(bf, "blip"), "embed");
      const img = rid ? await getImage(ctx.part.rels.get(rid)) : null;
      if (img) shapeList.push({ t: "img", x: b.x, y: b.y, w: b.w, h: b.h, img });
    } else if (fl.fill || ln) shapeList.push(...shapeOps(geom, b, fl.fill, ln, spPr, { h: xfrm.flipH, v: xfrm.flipV }));

    const tx = child(sp, "txBody");
    if (tx && geom !== "line") await textOps(tx, b, ctx, ph, layoutPh, masterPh, style, shapeList);
    ops.push(...wrapRot(shapeList, xfrm.rot, b));
  }

  function renderCxn(el: Element, ctx: Ctx, ops: Op[], xf: Xf) {
    const spPr = child(el, "spPr");
    const xfrm = getXfrm(spPr);
    if (!xfrm) return;
    const b = applyXf(xfrm, xf);
    const ln = lineOf(spPr, child(el, "style"), ctx) ?? { color: "#000000", w: 1 };
    ops.push(...wrapRot(shapeOps("line", b, undefined, ln, spPr, { h: xfrm.flipH, v: xfrm.flipV }), xfrm.rot, b));
  }

  async function renderPic(pic: Element, ctx: Ctx, ops: Op[], xf: Xf) {
    const spPr = child(pic, "spPr");
    const xfrm = getXfrm(spPr);
    if (!xfrm) return;
    const b = applyXf(xfrm, xf);
    const bf = child(pic, "blipFill");
    const rid = attr(child(bf, "blip"), "embed");
    const img = rid ? await getImage(ctx.part.rels.get(rid)) : null;
    if (!img) { notes.push("Beberapa gambar (format EMF/WMF/tertaut) tidak bisa dirender dan dilewati."); return; }
    const iw = (img as any).width as number, ih = (img as any).height as number;
    const sr = child(bf, "srcRect");
    const l = n(attr(sr, "l")) / 100000, t = n(attr(sr, "t")) / 100000, r = n(attr(sr, "r")) / 100000, bt = n(attr(sr, "b")) / 100000;
    const op: Op = { t: "img", x: b.x, y: b.y, w: b.w, h: b.h, img, flipH: xfrm.flipH, flipV: xfrm.flipV };
    if (l || t || r || bt) { op.sx = iw * l; op.sy = ih * t; op.sw = iw * (1 - l - r); op.sh = ih * (1 - t - bt); }
    ops.push(...wrapRot([op], xfrm.rot, b));
  }

  async function renderFrame(fr: Element, ctx: Ctx, ops: Op[], xf: Xf) {
    const x = child(fr, "xfrm");
    const off = child(x, "off"), ext = child(x, "ext");
    const b = applyXf({ x: n(attr(off, "x")) * EMU_PT, y: n(attr(off, "y")) * EMU_PT, w: n(attr(ext, "cx")) * EMU_PT, h: n(attr(ext, "cy")) * EMU_PT }, xf);
    const tbl = descendants(fr, "tbl")[0];
    if (tbl) { await renderTable(tbl, b, ctx, ops); return; }
    const isChart = descendants(fr, "chart").length > 0;
    notes.push(isChart ? "Grafik (chart) tidak bisa dirender dan diganti kotak keterangan." : "Objek khusus (SmartArt/OLE) tidak bisa dirender dan diganti kotak keterangan.");
    ops.push({ t: "rect", x: b.x, y: b.y, w: b.w, h: b.h, fill: "#f3f4f6", stroke: "#d1d5db", lw: 1 });
    ops.push({ t: "text", x: b.x + 10, y: b.y + b.h / 2, text: isChart ? "[Grafik]" : "[Objek]", style: defaultStyle({ size: 14, color: "#6b7280" }), w: 60 });
  }

  async function renderTable(tbl: Element, b: { x: number; y: number; w: number; h: number }, ctx: Ctx, ops: Op[]) {
    const grid = childEls(child(tbl, "tblGrid"), "gridCol").map((g) => n(attr(g, "w")) * EMU_PT);
    const gridSum = grid.reduce((a, c) => a + c, 0) || b.w;
    const k = b.w / gridSum;
    const cols = grid.map((g) => g * k);
    const tblPr = child(tbl, "tblPr");
    const firstRow = attr(tblPr, "firstRow") === "1", band = attr(tblPr, "bandRow") === "1";
    const accent = themeColors.get("accent1") ?? "#4472c4";
    let y = b.y;
    const trs = childEls(tbl, "tr");
    for (let ri = 0; ri < trs.length; ri++) {
      const tr = trs[ri];
      const rowH0 = n(attr(tr, "h")) * EMU_PT * k;
      const cellOps: Op[] = [];
      let x = b.x, col = 0, rowH = rowH0;
      const pending: (() => void)[] = [];
      for (const tc of childEls(tr, "tc")) {
        const span = n(attr(tc, "gridSpan"), 1);
        const cw = cols.slice(col, col + span).reduce((a, c) => a + c, 0);
        if (attr(tc, "hMerge") === "1" || attr(tc, "vMerge") === "1") { x += cw; col += span; continue; }
        const tcPr = child(tc, "tcPr");
        let fill: string | undefined;
        const sf = child(tcPr, "solidFill");
        if (sf) fill = css(resolveClr(sf, ctx.clrMap));
        else if (!child(tcPr, "noFill")) {
          if (firstRow && ri === 0) fill = accent;
          else if (band) fill = ri % 2 === 1 ? hslAdjust(accent, 0.2, 0.8) : hslAdjust(accent, 0.1, 0.9);
        }
        const tx = child(tc, "txBody");
        const cellBox = { x, y, w: cw, h: rowH0 || 20 };
        const sub: Op[] = [];
        let used = 0;
        if (tx) {
          const headerText = firstRow && ri === 0 && !sf;
          used = await textOps(tx, { x: cellBox.x, y: cellBox.y, w: cellBox.w, h: cellBox.h }, ctx, null, null, null, null, sub, { insets: [5.4, 3.6, 5.4, 3.6], colorOverride: headerText ? "#ffffff" : undefined, boldOverride: headerText, anchorOverride: "t", measureOnly: false });
        }
        rowH = Math.max(rowH, used + 4);
        const cx = x, cw2 = cw;
        pending.push(() => {
          if (fill) cellOps.push({ t: "rect", x: cx, y, w: cw2, h: rowH, fill });
          cellOps.push(...sub);
          const border = (side: "lnL" | "lnR" | "lnT" | "lnB", x1: number, y1: number, x2: number, y2: number) => {
            const l = child(tcPr, side);
            const lc = l && !child(l, "noFill") ? css(resolveClr(child(l, "solidFill"), ctx.clrMap)) : undefined;
            const color = lc ?? (l ? undefined : "#ffffff");
            if (color) cellOps.push({ t: "line", x1, y1, x2, y2, color, lw: Math.max(0.5, l ? n(attr(l, "w"), 12700) * EMU_PT : 0.75) });
          };
          border("lnL", cx, y, cx, y + rowH); border("lnR", cx + cw2, y, cx + cw2, y + rowH); border("lnT", cx, y, cx + cw2, y); border("lnB", cx, y + rowH, cx + cw2, y + rowH);
        });
        x += cw;
        col += span;
      }
      pending.forEach((f) => f());
      ops.push(...cellOps);
      y += rowH;
    }
  }

  interface TextOpt { insets?: [number, number, number, number]; colorOverride?: string; boldOverride?: boolean; anchorOverride?: string; measureOnly?: boolean }

  /** Menata & menggambar isi teks. Mengembalikan tinggi teks yang dipakai. */
  async function textOps(
    tx: Element,
    b: { x: number; y: number; w: number; h: number },
    ctx: Ctx,
    ph: { type: string; idx: string | null } | null,
    layoutPh: Element | null,
    masterPh: Element | null,
    style: Element | null,
    out: Op[],
    opt: TextOpt = {}
  ): Promise<number> {
    const bodyPr = child(tx, "bodyPr");
    const lbody = child(child(layoutPh, "txBody"), "bodyPr"), mbody = child(child(masterPh, "txBody"), "bodyPr");
    const bp = (name: string) => attr(bodyPr, name) ?? attr(lbody, name) ?? attr(mbody, name);
    const insets = opt.insets ?? [n(bp("lIns"), 91440) * EMU_PT, n(bp("tIns"), 45720) * EMU_PT, n(bp("rIns"), 91440) * EMU_PT, n(bp("bIns"), 45720) * EMU_PT];
    const anchor = opt.anchorOverride ?? bp("anchor") ?? "t";
    const noWrap = bp("wrap") === "none";
    const na = child(bodyPr, "normAutofit") ?? child(lbody, "normAutofit");
    let fontScale = na ? n(attr(na, "fontScale"), 100000) / 100000 : 1;
    const innerW = Math.max(10, b.w - insets[0] - insets[2]);
    const innerH = Math.max(10, b.h - insets[1] - insets[3]);

    const typeKey = ph ? (ph.type === "title" || ph.type === "ctrTitle" ? "title" : ph.type === "body" || ph.type === "subTitle" || ph.type === "obj" ? "body" : "other") : "other";
    const baseLst = ph ? (typeKey === "title" ? ctx.slideMasterTx.title : typeKey === "body" ? ctx.slideMasterTx.body : ctx.slideMasterTx.other) : defaultTextStyle;
    const chain: (Element | null)[] = [baseLst, child(child(masterPh, "txBody"), "lstStyle"), child(child(layoutPh, "txBody"), "lstStyle"), child(tx, "lstStyle")];
    const fontRefColor = css(resolveClr(child(style, "fontRef"), ctx.clrMap));

    interface PInfo { layout: ReturnType<typeof layoutParagraph>; spaceBefore: number; spaceAfter: number }
    const build = (scale: number): { paras: PInfo[]; height: number } => {
      const paras: PInfo[] = [];
      const counters: number[] = [];
      for (const p of childEls(tx, "p")) {
        const pPr = child(p, "pPr");
        const lvl = Math.min(8, n(attr(pPr, "lvl"), 0));
        const lp = mergeLvl([...chain, null].slice(0, chain.length), lvl);
        if (pPr) { lp.pPr.push(pPr); }
        const rBase: RunStyle = (() => {
          const defs = lp.defRPr;
          const get = (name: string) => { for (let i = defs.length - 1; i >= 0; i--) { const v = defs[i].getAttribute(name); if (v !== null) return v; } return null; };
          let color = fontRefColor ?? "#000000";
          // Gaya bentuk (fontRef, mis. teks putih di bentuk berwarna) lebih tinggi daripada defaultTextStyle presentasi.
          const baseDef = !ph && fontRefColor ? child(lvlOf(baseLst, lvl), "defRPr") : null;
          for (let i = defs.length - 1; i >= 0; i--) { if (defs[i] === baseDef) continue; const sf = child(defs[i], "solidFill"); if (sf) { color = css(resolveClr(sf, ctx.clrMap)) ?? color; break; } }
          let face: string | null = null;
          for (let i = defs.length - 1; i >= 0; i--) { const lat = child(defs[i], "latin"); if (lat) { face = attr(lat, "typeface"); break; } }
          return defaultStyle({ size: n(get("sz"), 1800) / 100, bold: get("b") === "1", italic: get("i") === "1", underline: !!get("u") && get("u") !== "none", color, font: cssFamily(fontFor(face)) });
        })();
        const mk = (rPr: Element | null): RunStyle => {
          const s = { ...rBase };
          if (rPr) {
            if (attr(rPr, "sz")) s.size = n(attr(rPr, "sz")) / 100;
            if (attr(rPr, "b")) s.bold = attr(rPr, "b") === "1";
            if (attr(rPr, "i")) s.italic = attr(rPr, "i") === "1";
            if (attr(rPr, "u")) s.underline = attr(rPr, "u") !== "none";
            if (attr(rPr, "strike")) s.strike = attr(rPr, "strike") !== "noStrike";
            const bl = n(attr(rPr, "baseline"));
            if (bl > 0) s.sup = true; else if (bl < 0) s.sub = true;
            const sf = child(rPr, "solidFill");
            if (sf) s.color = css(resolveClr(sf, ctx.clrMap)) ?? s.color;
            const lat = child(rPr, "latin");
            if (lat) s.font = cssFamily(fontFor(attr(lat, "typeface")));
            const hl = child(rPr, "highlight");
            if (hl) s.highlight = css(resolveClr(hl, ctx.clrMap));
          }
          if (opt.colorOverride) s.color = opt.colorOverride;
          if (opt.boldOverride) s.bold = true;
          s.size = Math.max(4, s.size * scale);
          return s;
        };
        const inl: Inline[] = [];
        for (const r of Array.from(p.children)) {
          if (r.localName === "r" || r.localName === "fld") {
            const t = child(r, "t")?.textContent ?? "";
            inl.push({ kind: "text", text: t, style: mk(child(r, "rPr")) });
          } else if (r.localName === "br") inl.push({ kind: "br" });
        }
        const endStyle = mk(child(p, "endParaRPr"));
        if (!inl.length) inl.push({ kind: "text", text: " ", style: endStyle });

        const marL = n(pAttr(lp, "marL"), 0) * EMU_PT;
        const indent = n(pAttr(lp, "indent"), 0) * EMU_PT;
        const algn = pAttr(lp, "algn");
        const lnSpc = pChild(lp, "lnSpc");
        const spcBef = pChild(lp, "spcBef"), spcAft = pChild(lp, "spcAft");
        const refSize = endStyle.size;
        const spacing = (el: Element | null) => {
          if (!el) return 0;
          const pts = child(el, "spcPts"), pct = child(el, "spcPct");
          if (pts) return (n(attr(pts, "val")) / 100) * scale;
          if (pct) return (n(attr(pct, "val")) / 100000) * refSize * 1.2;
          return 0;
        };
        let lineMult = 1, lineExact: number | undefined;
        if (lnSpc) {
          const pct = child(lnSpc, "spcPct"), pts = child(lnSpc, "spcPts");
          if (pct) lineMult = n(attr(pct, "val"), 100000) / 100000;
          else if (pts) lineExact = (n(attr(pts, "val")) / 100) * scale;
        }
        // bullet
        let bullet: ParaFmt["bullet"] | undefined;
        const buNone = pChild(lp, "buNone"), buChar = pChild(lp, "buChar"), buAuto = pChild(lp, "buAutoNum");
        const lastBu = (() => { for (let i = lp.pPr.length - 1; i >= 0; i--) for (const c of Array.from(lp.pPr[i].children)) if (["buNone", "buChar", "buAutoNum", "buBlip"].includes(c.localName)) return c; return null; })();
        if (lastBu && !buNone && lastBu === (buChar ?? buAuto) && inl.some((i) => i.kind === "text" && i.text.trim())) {
          if (lastBu.localName === "buChar") {
            let ch = attr(buChar, "char") || "•";
            if (ch.charCodeAt(0) >= 0xf000 || ["§", "Ø", "ü", "v", "q", "n"].includes(ch)) ch = "▪";
            bullet = { text: ch, style: { ...rBase, size: rBase.size * scale, color: rBase.color } };
          } else {
            counters.length = lvl + 1;
            counters[lvl] = (counters[lvl] ?? n(attr(buAuto, "startAt"), 1) - 1) + 1;
            const t = attr(buAuto, "type") || "arabicPeriod";
            const v = counters[lvl];
            const ltr = String.fromCharCode(96 + (((v - 1) % 26) + 1));
            const label = t.startsWith("alphaLc") ? ltr : t.startsWith("alphaUc") ? ltr.toUpperCase() : t.startsWith("romanLc") ? roman(v) : t.startsWith("romanUc") ? roman(v).toUpperCase() : String(v);
            bullet = { text: t.endsWith("ParenBoth") ? `(${label})` : t.endsWith("ParenR") ? `${label})` : `${label}.`, style: { ...rBase, size: rBase.size * scale } };
          }
        } else if (!lastBu || buNone) counters.length = Math.min(counters.length, lvl);
        const fmt = defaultParaFmt({
          align: algn === "ctr" ? "center" : algn === "r" ? "right" : algn === "just" ? "justify" : "left",
          indentLeft: bullet || indent < 0 ? marL : marL,
          firstLine: 0,
          spaceBefore: spacing(spcBef),
          spaceAfter: spacing(spcAft),
          lineMult: lineExact ? 1 : lineMult * 1.0,
          lineExact,
          bullet,
        });
        if (bullet) (fmt as any)._bulletX = indent < 0 ? indent : 0;
        else if (indent < 0) (fmt as any)._hanging = indent;
        else if (indent > 0) fmt.firstLine = indent;
        const layout = layoutParagraph(inl, fmt, noWrap ? 10000 : innerW);
        paras.push({ layout, spaceBefore: fmt.spaceBefore, spaceAfter: fmt.spaceAfter });
      }
      const height = paras.reduce((a, p, i) => a + paraHeight(p.layout, false) + (i > 0 ? p.spaceBefore : 0) + (i < paras.length - 1 ? p.spaceAfter : 0), 0);
      return { paras, height };
    };

    let built = build(fontScale);
    if (na && built.height > innerH && opt.anchorOverride === undefined) {
      for (let i = 0; i < 4 && built.height > innerH; i++) {
        fontScale = Math.max(0.45, fontScale * Math.max(0.5, Math.sqrt(innerH / built.height)) * 0.985);
        built = build(fontScale);
      }
    }
    if (opt.measureOnly) return built.height + insets[1] + insets[3];

    let y = b.y + insets[1];
    if (anchor === "ctr") y = b.y + insets[1] + Math.max(0, (innerH - built.height) / 2);
    else if (anchor === "b") y = b.y + insets[1] + Math.max(0, innerH - built.height);
    const clipOps: Op[] = [];
    built.paras.forEach((p, i) => {
      if (i > 0) y += p.spaceBefore;
      const hang = (p.layout.fmt as any)._hanging as number | undefined;
      const left = b.x + insets[0] + p.layout.fmt.indentLeft;
      const boxLeft = noWrap && p.layout.fmt.align === "center" ? b.x + b.w / 2 - 5000 : left;
      for (const ln of p.layout.lines) {
        emitLine(clipOps, ln, boxLeft + (hang && ln === p.layout.lines[0] ? hang : 0), y);
        y += ln.h;
      }
      if (i < built.paras.length - 1) y += p.spaceAfter;
    });
    out.push(...clipOps);
    return built.height + insets[1] + insets[3];
  }

  const roman = (v: number) => {
    const m: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
    let r = "";
    for (const [k, s] of m) while (v >= k) { r += s; v -= k; }
    return r;
  };

  // ── daftar slide ──
  const presRels = await readRels("ppt/presentation.xml");
  const slidePaths: string[] = [];
  for (const sid of descendants(pres, "sldId")) {
    const rid = attr(sid, "id") && (sid.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || attr(sid, "r:id") || [...Array.from(sid.attributes)].find((a) => a.localName === "id" && a.prefix === "r")?.value);
    const p = rid ? presRels.get(rid) : undefined;
    if (p) slidePaths.push(p);
  }
  if (!slidePaths.length) slidePaths.push(...zip.file(/^ppt\/slides\/slide\d+\.xml$/).map((f) => f.name).sort((a, b) => n(a.match(/(\d+)\.xml/)?.[1]) - n(b.match(/(\d+)\.xml/)?.[1])));
  if (!slidePaths.length) throw new Error("Tidak ada slide pada file .pptx ini.");

  const pages: RasterPage[] = [];
  for (const sp of slidePaths) {
    const slide = await loadPart(sp, "slide");
    if (!slide) continue;
    const layoutPath = [...slide.rels.values()].find((p) => /slideLayouts\//.test(p));
    const layout = layoutPath ? await loadPart(layoutPath, "layout") : null;
    const masterPath = layout ? [...layout.rels.values()].find((p) => /slideMasters\//.test(p)) : masterPaths[0];
    const master = masterPath ? await getMaster(masterPath) : null;
    const clrMap = clrMapOf(master);
    const base: Omit<Ctx, "part" | "skipPlaceholders"> = {
      clrMap, layout, master,
      slideMasterTx: { title: masterTx(master, "titleStyle"), body: masterTx(master, "bodyStyle"), other: masterTx(master, "otherStyle") },
    };

    const ops: Op[] = [];
    // latar: slide → layout → master
    let bg = "#ffffff";
    for (const part of [slide, layout, master]) {
      if (!part) continue;
      const bgEl = descendants(part.doc, "bg")[0];
      if (!bgEl) continue;
      const bgPr = child(bgEl, "bgPr");
      const sf = child(bgPr, "solidFill");
      const gf = child(bgPr, "gradFill");
      const ref = child(bgEl, "bgRef");
      const bf = child(bgPr, "blipFill");
      if (sf) bg = css(resolveClr(sf, clrMap)) ?? bg;
      else if (gf) { const stops = descendants(gf, "gs"); bg = css(resolveClr(stops[0], clrMap)) ?? bg; }
      else if (ref) bg = css(resolveClr(ref, clrMap)) ?? bg;
      else if (bf) {
        const img = await getImage(part.rels.get(attr(child(bf, "blip"), "embed") || ""));
        if (img) ops.push({ t: "img", x: 0, y: 0, w: SW, h: SH, img });
      } else continue;
      break;
    }

    const showMaster = attr(slide.doc.documentElement, "showMasterSp") !== "0" && (!layout || attr(layout.doc.documentElement, "showMasterSp") !== "0");
    if (master && showMaster) {
      const tree = descendants(master.doc, "spTree")[0];
      if (tree) await renderTree(tree, { ...base, part: master, skipPlaceholders: true }, ops, ID);
    }
    if (layout) {
      const tree = descendants(layout.doc, "spTree")[0];
      if (tree) await renderTree(tree, { ...base, part: layout, skipPlaceholders: true }, ops, ID);
    }
    const stree = descendants(slide.doc, "spTree")[0];
    if (stree) await renderTree(stree, { ...base, part: slide, skipPlaceholders: false }, ops, ID);
    pages.push({ w: SW, h: SH, bg, ops });
  }
  return { pages, notes: Array.from(new Set(notes)) };
}
