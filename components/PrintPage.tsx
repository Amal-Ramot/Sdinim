"use client";
import { useLayoutEffect, useRef } from "react";
import type { Doc, Prefs } from "@/lib/model";
import { cellColors, fmtCell, headerLabel, ruleCounts, verticalHeader } from "@/lib/model";

export const PAPER_MM: Record<Prefs["paper"], [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
};
const MM = 96 / 25.4;

export interface Layout {
  zoom: number;
  orient: "portrait" | "landscape";
  w: number; // mm
  h: number; // mm
}

export function pageSize(prefs: Prefs, orient: "portrait" | "landscape") {
  const [a, b] = PAPER_MM[prefs.paper] ?? PAPER_MM.A4;
  return orient === "landscape" ? { w: b, h: a } : { w: a, h: b };
}

/**
 * A single printable page. The table is measured at its natural size and then
 * scaled (CSS zoom, which affects layout) so it fills exactly one sheet of
 * paper. With "fill" on, the slack dimension is stretched too, so the table
 * covers the whole printable area.
 */
export default function PrintPage({
  doc,
  prefs,
  rows,
  onLayout,
}: {
  doc: Doc;
  prefs: Prefs;
  rows: number[];
  onLayout?: (l: Layout) => void;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const cb = useRef(onLayout);
  cb.current = onLayout;

  const vis = doc.cols.filter((c) => !c.hidden);
  const counts = ruleCounts(doc, prefs, rows);

  useLayoutEffect(() => {
    const run = () => {
      const page = pageRef.current;
      const fit = fitRef.current;
      const table = tableRef.current;
      if (!page || !fit || !table) return;
      fit.style.zoom = "1";
      fit.style.width = "max-content";
      table.style.width = "";
      table.style.height = "";
      table.style.removeProperty("--xpad");
      const w = fit.offsetWidth || 1;
      const h = fit.offsetHeight || 1;
      const m = prefs.margin;
      const inner = (o: "portrait" | "landscape") => {
        const s = pageSize(prefs, o);
        return { ...s, iw: (s.w - 2 * m) * MM, ih: (s.h - 2 * m - 0.8) * MM };
      };
      const zFor = (o: "portrait" | "landscape") => {
        const i = inner(o);
        return Math.min(i.iw / w, i.ih / h);
      };
      const orient: "portrait" | "landscape" =
        prefs.orient === "auto" ? (zFor("landscape") > zFor("portrait") ? "landscape" : "portrait") : prefs.orient;
      const { w: pw, h: ph, iw, ih } = inner(orient);
      page.style.width = `${pw}mm`;
      page.style.height = `${ph - 0.6}mm`;
      page.style.padding = `${m}mm`;
      // Fit with the zoom applied and measured, because text (especially the
      // vertical headers) lays out slightly differently at each zoom level.
      // Sizes are read in zoomed page pixels; `view` undoes any CSS transform
      // around the page (the on-screen preview is scaled down).
      let z = Math.min(iw / w, ih / h);
      fit.style.zoom = String(z);
      const view = page.getBoundingClientRect().width / page.offsetWidth || 1;
      const size = () => {
        const r = fit.getBoundingClientRect();
        return { w: r.width / view, h: r.height / view };
      };
      const cols = table.tHead?.rows[0]?.cells.length || 1;
      let xpad = 0;
      let rowsH = 0;
      for (let i = 0; i < 8; i++) {
        let s = size();
        if (s.w > iw + 0.5 || s.h > ih + 0.5) {
          z *= Math.min(iw / s.w, ih / s.h) * 0.998;
          fit.style.zoom = String(z);
          continue;
        }
        if (!prefs.fill) break;
        // Share the leftover space out: extra width evenly between all columns
        // (as side padding, so every column grows by the same amount) and extra
        // height between the rows.
        const dw = iw - s.w;
        if (dw > 1) {
          xpad += dw / z / (2 * cols);
          table.style.setProperty("--xpad", `${xpad}px`);
          s = size();
        }
        const dh = ih - s.h;
        if (dh > 1) {
          rowsH = (rowsH || table.offsetHeight) + dh / z;
          table.style.height = `${rowsH}px`;
        }
        if (dw <= 1 && dh <= 1) break;
      }
      cb.current?.({ zoom: z, orient, w: pw, h: ph });
    };
    // Re-fit whenever the table's own size changes for reasons other than our
    // fitting (e.g. a web font finishing loading after the first layout).
    let last = "";
    const fitAgain = () => {
      const f = fitRef.current;
      if (!f) return;
      const now = `${f.offsetWidth}x${f.offsetHeight}`;
      if (now !== last) {
        run();
        last = `${f.offsetWidth}x${f.offsetHeight}`;
      }
    };
    run();
    last = `${fitRef.current?.offsetWidth}x${fitRef.current?.offsetHeight}`;
    const ro = new ResizeObserver(fitAgain);
    if (fitRef.current) ro.observe(fitRef.current);
    let alive = true;
    document.fonts?.ready.then(() => alive && (run(), (last = `${fitRef.current?.offsetWidth}x${fitRef.current?.offsetHeight}`)));
    document.fonts?.addEventListener?.("loadingdone", fitAgain);
    return () => {
      alive = false;
      ro.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", fitAgain);
    };
  }, [doc, prefs, rows]);

  return (
    <div className="page" ref={pageRef}>
      <div className="fit" ref={fitRef}>
        {prefs.showTitle && (
          <header className="print-head">
            <h1>{doc.title}</h1>
            {prefs.subtitle && <p>{prefs.subtitle}</p>}
          </header>
        )}
        <table ref={tableRef} className={`sheet sheet-print density-${prefs.density}${prefs.zebra ? " zebra" : ""}`}>
          <thead>
            <tr>
              {vis.map((c) => (
                <th key={c.id} className={c.color ? "grade" : undefined}>
                  <div className={`th-in${verticalHeader(c, prefs) ? " vertical" : ""}`}>
                    <span className="th-label">{headerLabel(c.name, prefs.headerMode)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className={doc.summary[r] ? "summary" : undefined}>
                {vis.map((c) => (
                  <td key={c.id} style={cellColors(prefs, c, c.cells[r]) ?? undefined}>
                    {fmtCell(c, c.cells[r])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {prefs.showLegend && prefs.rules.length > 0 && vis.some((c) => c.color) && (
          <footer className="print-legend">
            {prefs.rules.map((r) => (
              <span key={r.id} className="lg">
                <i style={{ background: prefs.colorMode === "text" ? r.fg : r.bg, borderColor: r.fg }} />
                {r.label ? `${r.label} ` : ""}
                {Math.min(r.from, r.to)}–{Math.max(r.from, r.to)}
                <b>({counts.get(r.id) || 0})</b>
              </span>
            ))}
          </footer>
        )}
      </div>
    </div>
  );
}
