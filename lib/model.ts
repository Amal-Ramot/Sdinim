// Core data model: parsing spreadsheets into an editable document, smart
// cleanup, merging, color rules and formatting helpers.

export type Cell = string | number;

export interface Col {
  id: string;
  name: string;
  cells: Cell[];
  hidden: boolean;
  /** whether color rules apply to this column */
  color: boolean;
}

export interface Doc {
  title: string;
  fileName: string;
  cols: Col[];
  /** display order of row indices */
  rowOrder: number[];
  /** rows flagged as summary (e.g. class averages) — always kept last */
  summary: boolean[];
  sort: { id: string; dir: 1 | -1 } | null;
}

export interface Rule {
  id: string;
  from: number;
  to: number;
  bg: string;
  fg: string;
  label: string;
}

export type ColorMode = "bg" | "text" | "both";
export type HeaderMode = "full" | "first" | "clean";
export type Paper = "A4" | "A3" | "Letter";
export type Orient = "auto" | "portrait" | "landscape";

export interface Prefs {
  rules: Rule[];
  colorMode: ColorMode;
  round: boolean;
  headerMode: HeaderMode;
  vertical: boolean;
  zebra: boolean;
  paper: Paper;
  orient: Orient;
  margin: number;
  fill: boolean;
  showTitle: boolean;
  showLegend: boolean;
  subtitle: string;
  density: "compact" | "normal" | "airy";
}

let idSeq = 0;
export const uid = (p = "c") => `${p}${Date.now().toString(36)}${(idSeq++).toString(36)}`;

export const RULE_PRESETS: Record<string, { name: string; rules: Omit<Rule, "id">[] }> = {
  traffic: {
    name: "רמזור (4 טווחים)",
    rules: [
      { from: 0, to: 54, bg: "#fecaca", fg: "#991b1b", label: "נכשל" },
      { from: 55, to: 69, bg: "#fed7aa", fg: "#9a3412", label: "מתקשה" },
      { from: 70, to: 84, bg: "#fef08a", fg: "#854d0e", label: "טוב" },
      { from: 85, to: 100, bg: "#bbf7d0", fg: "#166534", label: "מצוין" },
    ],
  },
  fail: {
    name: "רק שליליים",
    rules: [{ from: 0, to: 54, bg: "#fecaca", fg: "#991b1b", label: "שלילי" }],
  },
  three: {
    name: "שלושה טווחים",
    rules: [
      { from: 0, to: 54, bg: "#fecaca", fg: "#991b1b", label: "נכשל" },
      { from: 55, to: 79, bg: "#fef08a", fg: "#854d0e", label: "בינוני" },
      { from: 80, to: 100, bg: "#bbf7d0", fg: "#166534", label: "גבוה" },
    ],
  },
  excellence: {
    name: "הצטיינות",
    rules: [
      { from: 90, to: 94, bg: "#bfdbfe", fg: "#1e3a8a", label: "מצטיין" },
      { from: 95, to: 100, bg: "#c7d2fe", fg: "#312e81", label: "מצטיין יתרה" },
    ],
  },
};

export const withIds = (rules: Omit<Rule, "id">[]): Rule[] => rules.map((r) => ({ ...r, id: uid("r") }));

export const DEFAULT_PREFS: Prefs = {
  rules: withIds(RULE_PRESETS.traffic.rules),
  colorMode: "bg",
  round: true,
  headerMode: "full",
  vertical: true,
  zebra: true,
  paper: "A4",
  orient: "auto",
  margin: 8,
  fill: true,
  showTitle: true,
  showLegend: true,
  subtitle: "",
  density: "normal",
};

// ---------- value helpers ----------

export function toNum(v: Cell | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return parseFloat(t);
}

export const isEmpty = (v: Cell | undefined) => v === undefined || v === null || String(v).trim() === "";

export function fmt(v: Cell | undefined): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 100) / 100);
  }
  return String(v);
}

export function normalizeInput(s: string): Cell {
  const t = s.trim();
  const n = toNum(t);
  return n === null ? t : n;
}

export function headerLabel(name: string, mode: HeaderMode): string {
  const lines = name
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  if (mode === "first") return lines[0];
  if (mode === "clean") return lines.filter((l) => !/^\[\d+\]$/.test(l)).join("\n");
  return lines.join("\n");
}

export function ruleFor(prefs: Prefs, v: Cell | undefined): Rule | null {
  let n = toNum(v);
  if (n === null) return null;
  if (prefs.round) n = Math.round(n);
  for (const r of prefs.rules) {
    const lo = Math.min(r.from, r.to);
    const hi = Math.max(r.from, r.to);
    if (n >= lo && n <= hi) return r;
  }
  return null;
}

export function cellColors(prefs: Prefs, col: Col, v: Cell | undefined): { background?: string; color?: string } | null {
  if (!col.color) return null;
  const r = ruleFor(prefs, v);
  if (!r) return null;
  if (prefs.colorMode === "bg") return { background: r.bg, color: "#0f172a" };
  if (prefs.colorMode === "text") return { color: r.fg };
  return { background: r.bg, color: r.fg };
}

// ---------- parsing ----------

export function docFromAoa(aoa: Cell[][], fileName: string): Doc {
  const rows = aoa.map((r) => (r || []).map((c) => (c === null || c === undefined ? "" : c)));
  // header = row (in the first 25) with the most non-empty text cells
  let headerIdx = 0;
  let best = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const score = rows[i].filter((c) => !isEmpty(c) && toNum(c) === null).length;
    if (score > best) {
      best = score;
      headerIdx = i;
    }
  }
  let title = "";
  for (let i = 0; i < headerIdx && !title; i++) {
    const c = rows[i].find((x) => !isEmpty(x));
    if (c !== undefined) title = String(c).trim();
  }
  const header = rows[headerIdx] || [];
  const data = rows.slice(headerIdx + 1).filter((r) => r.some((c) => !isEmpty(c)));
  const ncols = Math.max(header.length, ...data.map((r) => r.length), 0);

  let cols: Col[] = [];
  for (let c = 0; c < ncols; c++) {
    const name = String(header[c] ?? "").trim();
    const cells = data.map((r) => {
      const v = r[c];
      if (typeof v === "string") {
        const n = toNum(v);
        return n === null ? v.trim() : n;
      }
      return v ?? "";
    });
    if (!name && cells.every(isEmpty)) continue;
    cols.push({ id: uid(), name: name || `עמודה ${c + 1}`, cells, hidden: false, color: false });
  }

  // summary rows: rows where the "name" column (first mostly-text column) is empty
  const nameCol = cols.find((col) => {
    const vals = col.cells.filter((v) => !isEmpty(v));
    return vals.length > 0 && vals.filter((v) => toNum(v) === null).length / vals.length > 0.8;
  });
  const summary = data.map((_, r) => (nameCol ? isEmpty(nameCol.cells[r]) : false));

  cols = cols.map((col) => ({ ...col, color: isGradeCol(col, summary) }));

  return {
    title: title || fileName.replace(/\.[^.]+$/, ""),
    fileName,
    cols,
    rowOrder: data.map((_, i) => i),
    summary,
    sort: null,
  };
}

const NON_GRADE_HEADER = /^(מס['׳]?|#|מספר|שכבה|כיתה|מקבילה|שליליים|מס שליליים|ת\.?ז|ת["״]ז|טלפון)/;

export function isGradeCol(col: Col, summary: boolean[]): boolean {
  const vals = col.cells.filter((v, r) => !summary[r] && !isEmpty(v));
  if (!vals.length) return false;
  const nums = vals.map(toNum).filter((n): n is number => n !== null);
  if (nums.length / vals.length < 0.8) return false;
  if (Math.max(...nums) > 100 || Math.min(...nums) < 0) return false;
  if (NON_GRADE_HEADER.test(col.name.trim())) return false;
  // sequential running number 1..n
  if (nums.length > 3 && nums.every((n, i) => n === i + 1)) return false;
  return true;
}

// ---------- smart operations (mutate a cloned doc) ----------

export function subjectKey(name: string): string {
  const first = name.split(/\r?\n/)[0] || "";
  return first
    .split(/\s+/)
    .filter((t) => t && !/[-–]/.test(t) && !/^\[\d+\]$/.test(t))
    .join(" ")
    .trim();
}

export function mergeCols(doc: Doc, ids: string[], name?: string): { conflicts: number; id: string } | null {
  const sources = doc.cols.filter((c) => ids.includes(c.id));
  if (sources.length < 2) return null;
  const n = doc.summary.length;
  let conflicts = 0;
  const cells: Cell[] = [];
  for (let r = 0; r < n; r++) {
    const vals = sources.map((s) => s.cells[r]).filter((v) => !isEmpty(v));
    if (vals.length > 1 && !doc.summary[r]) conflicts++;
    cells.push(vals[0] ?? "");
  }
  const merged: Col = {
    id: uid(),
    name: name || subjectKey(sources[0].name) || sources[0].name,
    cells,
    hidden: false,
    color: sources.some((s) => s.color),
  };
  const firstIdx = doc.cols.findIndex((c) => ids.includes(c.id));
  doc.cols = doc.cols.filter((c) => !ids.includes(c.id));
  doc.cols.splice(firstIdx, 0, merged);
  recomputeSummaryFor(doc, merged);
  return { conflicts, id: merged.id };
}

export function recomputeSummaryFor(doc: Doc, col: Col) {
  if (!doc.summary.some(Boolean)) return;
  const nums = col.cells
    .map((v, r) => (doc.summary[r] ? null : toNum(v)))
    .filter((x): x is number => x !== null);
  const avg = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : "";
  doc.summary.forEach((s, r) => {
    if (s) col.cells[r] = avg;
  });
}

export function sortDoc(doc: Doc, id: string, dir: 1 | -1) {
  const col = doc.cols.find((c) => c.id === id);
  if (!col) return;
  const coll = new Intl.Collator("he", { numeric: true });
  const body = doc.rowOrder.filter((r) => !doc.summary[r]);
  const tail = doc.rowOrder.filter((r) => doc.summary[r]);
  body.sort((a, b) => {
    const va = col.cells[a];
    const vb = col.cells[b];
    if (isEmpty(va) && isEmpty(vb)) return 0;
    if (isEmpty(va)) return 1;
    if (isEmpty(vb)) return -1;
    const na = toNum(va);
    const nb = toNum(vb);
    if (na !== null && nb !== null) return (na - nb) * dir;
    return coll.compare(String(va), String(vb)) * dir;
  });
  doc.rowOrder = [...body, ...tail];
  doc.sort = { id, dir };
}

// ---------- stats ----------

export function ruleCounts(doc: Doc, prefs: Prefs, rows: number[]) {
  const counts = new Map<string, number>();
  for (const col of doc.cols) {
    if (col.hidden || !col.color) continue;
    for (const r of rows) {
      if (doc.summary[r]) continue;
      const rule = ruleFor(prefs, col.cells[r]);
      if (rule) counts.set(rule.id, (counts.get(rule.id) || 0) + 1);
    }
  }
  return counts;
}
