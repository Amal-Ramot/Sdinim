import type { Cell } from "./model";

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
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: "", blankrows: true });
    // Cells formatted as percentages are stored as fractions (0.92); keep them as "92%".
    if (ws["!ref"]) {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (const addr of Object.keys(ws)) {
        if (addr[0] === "!") continue;
        const cell = ws[addr];
        if (cell?.t !== "n" || typeof cell.w !== "string" || !/%\s*$/.test(cell.w)) continue;
        const { r, c } = XLSX.utils.decode_cell(addr);
        const row = aoa[r - range.s.r];
        if (row && c - range.s.c < row.length) row[c - range.s.c] = `${Math.round(cell.v * 10000) / 100}%`;
      }
    }
    return { name, aoa };
  }).filter((s) => s.aoa.length > 0);
  return { fileName: file.name, sheets };
}
