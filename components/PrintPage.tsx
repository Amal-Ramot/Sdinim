"use client";
import { useLayoutEffect, useRef } from "react";
import type { Doc, Prefs } from "@/lib/model";
import { cellColors, fmtCell, headerLabel, ruleCounts } from "@/lib/model";

export const PAPER_MM: Record<Prefs["paper"], [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  Letter: [216, 279],
};
const MM = 96 / 25.4;

export interface Layout {
  zoom: number;
  orient: "portrait" | "landscape";
  w: number; // mm
  h: number; // mm
}

export function pageSize(prefs: Prefs, orient: "portrait" | "landscape") {
  const [a, b] = PAPER_MM[prefs.paper];
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
      let z = Math.min(iw / w, ih / h);
      if (prefs.fill) {
        fit.style.width = `${iw / z}px`;
        table.style.width = "100%";
        const h2 = fit.offsetHeight;
        const target = ih / z;
        if (h2 < target - 1) table.style.height = `${table.offsetHeight + (target - h2)}px`;
      }
      z = Math.min(z, iw / fit.offsetWidth, ih / fit.offsetHeight) * 0.997;
      fit.style.zoom = String(z);
      cb.current?.({ zoom: z, orient, w: pw, h: ph });
    };
    run();
    let alive = true;
    document.fonts?.ready.then(() => alive && run());
    return () => {
      alive = false;
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
                  <div className={`th-in${prefs.vertical && c.color ? " vertical" : ""}`}>
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
