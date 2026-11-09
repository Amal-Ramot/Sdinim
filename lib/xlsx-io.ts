import type { Cell, Doc, Prefs } from "./model";
import { cellColors, fmt, headerLabel, toNum } from "./model";

type XLSXMod = typeof import("xlsx-js-style");
let mod: Promise<XLSXMod> | null = null;
const load = () => (mod ??= import("xlsx-js-style"));

export interface Workbook {
  fileName: string;
  sheets: { name: string; aoa: Cell[][] }[];
}

export async function readWorkbook(file: File): Promise<Workbook> {
  const XLSX = await load();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellStyles: false });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    aoa: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: "" }),
  })).filter((s) => s.aoa.length > 0);
  return { fileName: file.name, sheets };
}

const hex = (c?: string) => (c || "#000000").replace("#", "").toUpperCase();

export async function exportDoc(doc: Doc, prefs: Prefs, rows: number[]) {
  const XLSX = await load();
  const cols = doc.cols.filter((c) => !c.hidden);
  const border = {
    top: { style: "thin", color: { rgb: "94A3B8" } },
    bottom: { style: "thin", color: { rgb: "94A3B8" } },
    left: { style: "thin", color: { rgb: "94A3B8" } },
    right: { style: "thin", color: { rgb: "94A3B8" } },
  };
  const aoa: unknown[][] = [];
  aoa.push([{ v: doc.title, t: "s", s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "right", readingOrder: 2 } } }]);
  aoa.push([]);
  aoa.push(
    cols.map((c) => ({
      v: headerLabel(c.name, prefs.headerMode),
      t: "s",
      s: {
        font: { bold: true },
        fill: { fgColor: { rgb: "E2E8F0" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true, readingOrder: 2, textRotation: prefs.vertical && c.color ? 90 : 0 },
        border,
      },
    })),
  );
  for (const r of rows) {
    aoa.push(
      cols.map((c) => {
        const v = c.cells[r];
        const n = toNum(v);
        const colors = cellColors(prefs, c, v);
        const s: Record<string, unknown> = {
          alignment: { horizontal: "center", vertical: "center", readingOrder: 2 },
          border,
          font: { bold: !!doc.summary[r], color: colors?.color ? { rgb: hex(colors.color) } : undefined },
        };
        if (colors?.background) s.fill = { fgColor: { rgb: hex(colors.background) } };
        if (n !== null && !/^0\d/.test(String(v))) return { v: n, t: "n", s };
        return { v: fmt(v), t: "s", s };
      }),
    );
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = cols.map((c) => {
    const len = Math.max(...c.cells.map((v) => fmt(v).length), 3);
    return { wch: c.color ? 7 : Math.min(28, len + 2) };
  });
  ws["!rows"] = [{}, {}, { hpt: prefs.vertical ? 120 : 45 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, cols.length - 1) } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "גיליון");
  (wb as { Workbook?: unknown }).Workbook = { Views: [{ RTL: true }] };
  const base = doc.fileName.replace(/\.[^.]+$/, "") || "גיליון";
  const data = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base} - ערוך.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
