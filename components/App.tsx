"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  ArrowLeftRight,
  ArrowUpNarrowWide,
  Columns3,
  Download,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Merge,
  Moon,
  Palette,
  Pencil,
  Printer,
  Redo2,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Table2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import type { Col, Doc } from "@/lib/model";
import { demoAoa, docFromAoa, fmt, headerLabel, mergeCols, sortDoc } from "@/lib/model";
import { readWorkbook, exportDoc, type Workbook } from "@/lib/xlsx-io";
import { useHistory, usePrefs, useTheme } from "@/lib/store";
import { ContextMenu, PromptDialog, ToastProvider, useToast, type MenuItem } from "./ui";
import SheetTable from "./SheetTable";
import PrintPage, { type Layout } from "./PrintPage";
import { ColorsPanel, ColumnsPanel, PrintPanel } from "./Panels";

type Tab = "cols" | "colors" | "print";
type View = "edit" | "preview";

export default function AppRoot() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

function App() {
  const toast = useToast();
  const { doc, commit, reset, undo, redo, canUndo, canRedo } = useHistory();
  const { prefs, update } = usePrefs();
  const { theme, toggle } = useTheme();
  const [wb, setWb] = useState<Workbook | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("cols");
  const [view, setView] = useState<View>("edit");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [rename, setRename] = useState<Col | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // ---------- loading ----------
  const openFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const w = await readWorkbook(file);
        if (!w.sheets.length) throw new Error("empty");
        setWb(w);
        setSheetIdx(0);
        reset(docFromAoa(w.sheets[0].aoa, w.fileName));
        setView("edit");
        toast(`נטען: ${file.name}`);
      } catch {
        toast("לא הצלחנו לקרוא את הקובץ. ודאו שזה קובץ Excel או CSV תקין.", "warn");
      } finally {
        setBusy(false);
      }
    },
    [reset, toast],
  );

  const openDemo = () => {
    setWb(null);
    reset(docFromAoa(demoAoa(), "דוגמה.xlsx"));
    toast("נטענו נתוני הדגמה (שמות בדויים)", "info");
  };

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        setDragOver(true);
      }
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragOver(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) openFile(f);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [openFile]);

  // ---------- keyboard ----------
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) (e.preventDefault(), undo());
      else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) (e.preventDefault(), redo());
      else if (mod && e.key.toLowerCase() === "o") (e.preventDefault(), fileInput.current?.click());
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [undo, redo]);

  // ---------- derived ----------
  const rows = useMemo(() => {
    if (!doc) return [];
    const q = query.trim();
    if (!q) return doc.rowOrder;
    const vis = doc.cols.filter((c) => !c.hidden);
    return doc.rowOrder.filter((r) => doc.summary[r] || vis.some((c) => fmt(c.cells[r]).includes(q)));
  }, [doc, query]);

  const onLayout = useCallback((l: Layout) => {
    setLayout((p) => (p && p.orient === l.orient && Math.abs(p.zoom - l.zoom) < 0.001 && p.w === l.w ? p : l));
  }, []);

  // ---------- actions ----------
  const moveCol = useCallback(
    (a: string, b: string) =>
      commit((d) => {
        const from = d.cols.findIndex((c) => c.id === a);
        const to = d.cols.findIndex((c) => c.id === b);
        if (from < 0 || to < 0) return;
        const [c] = d.cols.splice(from, 1);
        d.cols.splice(to, 0, c);
      }),
    [commit],
  );

  const doMerge = (ids: string[]) => {
    if (!doc) return;
    const next = structuredClone(doc);
    const res = mergeCols(next, ids);
    if (!res) return;
    commit((d) => Object.assign(d, next));
    toast(`${ids.length} עמודות מוזגו לעמודה אחת`);
    if (res.conflicts) toast(`${res.conflicts} שורות הכילו כמה ערכים — נשמר הראשון`, "warn");
  };

  const headerMenu = (col: Col, x: number, y: number) => {
    const i = doc!.cols.findIndex((c) => c.id === col.id);
    const items: MenuItem[] = [
      { label: "מיון עולה", icon: <ArrowUpNarrowWide size={15} />, onClick: () => commit((d) => sortDoc(d, col.id, 1)) },
      { label: "מיון יורד", icon: <ArrowDownWideNarrow size={15} />, onClick: () => commit((d) => sortDoc(d, col.id, -1)) },
      { divider: true, label: "" },
      { label: "שינוי שם", icon: <Pencil size={15} />, onClick: () => setRename(col) },
      {
        label: "צביעת ציונים",
        icon: <Palette size={15} />,
        checked: col.color,
        onClick: () => commit((d) => d.cols.forEach((c) => c.id === col.id && (c.color = !c.color))),
      },
      { label: "הסתרה", icon: <EyeOff size={15} />, onClick: () => commit((d) => d.cols.forEach((c) => c.id === col.id && (c.hidden = true))) },
    ];
    const next = doc!.cols.slice(i + 1).find((c) => !c.hidden);
    if (next)
      items.push({
        label: `מיזוג עם „${headerLabel(next.name, "first").slice(0, 18)}”`,
        icon: <Merge size={15} />,
        onClick: () => doMerge([col.id, next.id]),
      });
    items.push(
      { divider: true, label: "" },
      { label: "מחיקת עמודה", icon: <Trash2 size={15} />, danger: true, onClick: () => commit((d) => (d.cols = d.cols.filter((c) => c.id !== col.id))) },
    );
    setMenu({ x, y, items });
  };

  const cellMenu = (col: Col, row: number, x: number, y: number) => {
    setMenu({
      x,
      y,
      items: [
        {
          label: "מחיקת שורה",
          icon: <Trash2 size={15} />,
          danger: true,
          onClick: () => commit((d) => (d.rowOrder = d.rowOrder.filter((r) => r !== row))),
        },
        { divider: true, label: "" },
        { label: "מיון עולה לפי עמודה זו", icon: <ArrowUpNarrowWide size={15} />, onClick: () => commit((d) => sortDoc(d, col.id, 1)) },
        { label: "מיון יורד לפי עמודה זו", icon: <ArrowDownWideNarrow size={15} />, onClick: () => commit((d) => sortDoc(d, col.id, -1)) },
        { label: "הסתרת העמודה", icon: <EyeOff size={15} />, onClick: () => commit((d) => d.cols.forEach((c) => c.id === col.id && (c.hidden = true))) },
      ],
    });
  };

  const switchSheet = (i: number) => {
    if (!wb) return;
    setSheetIdx(i);
    reset(docFromAoa(wb.sheets[i].aoa, wb.fileName));
  };

  const doPrint = () => {
    requestAnimationFrame(() => window.print());
  };

  const doExport = async () => {
    if (!doc) return;
    await exportDoc(doc, prefs, rows);
    toast("קובץ Excel עם הצבעים הורד");
  };

  // ---------- render ----------
  const visCount = doc?.cols.filter((c) => !c.hidden).length ?? 0;

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="logo">
              <Table2 size={18} />
            </span>
            <span className="brand-text">
              <b>סדינים</b>
              <small>עורך גיליונות ציונים</small>
            </span>
          </div>

          {doc && (
            <div className="doc-meta">
              <FileSpreadsheet size={16} />
              <span className="fname" title={doc.fileName}>
                {doc.fileName}
              </span>
              {wb && wb.sheets.length > 1 && (
                <select className="sheet-select" value={sheetIdx} onChange={(e) => switchSheet(Number(e.target.value))}>
                  {wb.sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="spacer" />

          {doc && (
            <>
              <div className="search">
                <Search size={15} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש תלמיד/ה…" aria-label="חיפוש" />
                {query && (
                  <button className="icon-btn xs" onClick={() => setQuery("")} aria-label="ניקוי">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="btn-group">
                <button className="icon-btn" onClick={undo} disabled={!canUndo} title="ביטול (Ctrl+Z)" aria-label="ביטול">
                  <Undo2 size={17} />
                </button>
                <button className="icon-btn" onClick={redo} disabled={!canRedo} title="חזרה (Ctrl+Y)" aria-label="חזרה">
                  <Redo2 size={17} />
                </button>
              </div>
            </>
          )}
          <button className="icon-btn" onClick={toggle} title="מצב תצוגה" aria-label="החלפת ערכת צבעים">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="btn ghost" onClick={() => fileInput.current?.click()}>
            <Upload size={16} /> <span className="hide-sm">פתיחת קובץ</span>
          </button>
          {doc && (
            <>
              <button className="btn ghost" onClick={doExport}>
                <Download size={16} /> <span className="hide-sm">Excel</span>
              </button>
              <button className="btn primary" onClick={doPrint}>
                <Printer size={16} /> <span className="hide-sm">הדפסה</span>
              </button>
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".xlsx,.xls,.xlsm,.csv,.ods"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) openFile(f);
              e.target.value = "";
            }}
          />
        </header>

        {!doc ? (
          <Landing onOpen={() => fileInput.current?.click()} onDemo={openDemo} busy={busy} />
        ) : (
          <div className="workspace">
            <aside className="sidebar">
              <nav className="tabs" role="tablist">
                <TabBtn on={tab === "cols"} onClick={() => setTab("cols")} icon={<Columns3 size={16} />} label="עמודות" />
                <TabBtn on={tab === "colors"} onClick={() => setTab("colors")} icon={<Palette size={16} />} label="צביעה" />
                <TabBtn
                  on={tab === "print"}
                  onClick={() => {
                    setTab("print");
                    setView("preview");
                  }}
                  icon={<Printer size={16} />}
                  label="הדפסה"
                />
              </nav>
              <div className="sidebar-body">
                {tab === "cols" && (
                  <ColumnsPanel
                    doc={doc}
                    commit={commit}
                    moveCol={moveCol}
                    onRename={setRename}
                  />
                )}
                {tab === "colors" && <ColorsPanel doc={doc} prefs={prefs} rows={rows} update={update} commit={commit} />}
                {tab === "print" && (
                  <PrintPanel doc={doc} prefs={prefs} update={update} commit={commit} layout={layout} onPrint={doPrint} />
                )}
              </div>
            </aside>

            <main className="stage">
              <div className="stage-bar">
                <div className="seg view-seg">
                  <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>
                    <Table2 size={15} /> עריכה
                  </button>
                  <button className={view === "preview" ? "on" : ""} onClick={() => setView("preview")}>
                    <FileText size={15} /> תצוגת הדפסה
                  </button>
                </div>
                <input
                  className="title-input"
                  value={doc.title}
                  onChange={(e) => commit((d) => (d.title = e.target.value))}
                  aria-label="כותרת"
                />
                <div className="stats">
                  <span>
                    <b>{rows.filter((r) => !doc.summary[r]).length}</b> שורות
                  </span>
                  <span>
                    <b>{visCount}</b>/{doc.cols.length} עמודות
                  </span>
                  {layout && (
                    <span className="pill">
                      <Printer size={12} /> {Math.round(layout.zoom * 100)}% · {layout.orient === "landscape" ? "לרוחב" : "לאורך"}
                    </span>
                  )}
                </div>
              </div>

              {view === "edit" ? (
                <div className="sheet-card">
                  {visCount === 0 ? (
                    <div className="empty-cols">כל העמודות מוסתרות — הציגו עמודות מהלשונית „עמודות”.</div>
                  ) : (
                    <SheetTable
                      doc={doc}
                      prefs={prefs}
                      rows={rows}
                      commit={commit}
                      onHeaderMenu={headerMenu}
                      onCellMenu={cellMenu}
                      moveCol={moveCol}
                    />
                  )}
                  <div className="kbd-hint">
                    <ArrowLeftRight size={13} /> גררו כותרות להזזה · לחיצה כפולה או הקלדה לעריכה · Enter לשורה הבאה · לחיצה ימנית לתפריט
                  </div>
                </div>
              ) : (
                <Preview doc={doc} prefs={prefs} rows={rows} />
              )}
            </main>
          </div>
        )}
      </div>

      {/* Off-screen page used for the real print; always fitted to one sheet. */}
      {doc && (
        <div id="print-host" aria-hidden>
          <style>{`@page { size: ${layout?.w ?? 210}mm ${layout?.h ?? 297}mm; margin: 0; }`}</style>
          <PrintPage doc={doc} prefs={prefs} rows={rows} onLayout={onLayout} />
        </div>
      )}

      {dragOver && (
        <div className="drop-overlay">
          <div>
            <Upload size={40} />
            <b>שחררו כאן את קובץ האקסל</b>
          </div>
        </div>
      )}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
      {rename && (
        <PromptDialog
          title="שינוי שם עמודה"
          initial={rename.name}
          multiline
          onClose={() => setRename(null)}
          onSubmit={(v) => commit((d) => d.cols.forEach((c) => c.id === rename.id && (c.name = v.trim() || c.name)))}
        />
      )}
    </>
  );
}

function TabBtn({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button role="tab" aria-selected={on} className={on ? "on" : ""} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function Preview({ doc, prefs, rows }: { doc: Doc; prefs: import("@/lib/model").Prefs; rows: number[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [l, setL] = useState<Layout | null>(null);
  const [avail, setAvail] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onLayout = useCallback(
    (n: Layout) => setL((p) => (p && p.orient === n.orient && Math.abs(p.zoom - n.zoom) < 0.001 && p.w === n.w ? p : n)),
    [],
  );
  const MM = 96 / 25.4;
  const pw = (l?.w ?? 210) * MM;
  const ph = (l?.h ?? 297) * MM;
  const s = Math.min((avail.w - 32) / pw, (avail.h - 32) / ph, 1.4);
  return (
    <div className="preview" ref={box}>
      <div className="preview-frame" style={{ width: pw * s, height: ph * s }}>
        <div style={{ transform: `scale(${s})`, transformOrigin: "top right", width: pw, height: ph }}>
          <PrintPage doc={doc} prefs={prefs} rows={rows} onLayout={onLayout} />
        </div>
      </div>
    </div>
  );
}

function Landing({ onOpen, onDemo, busy }: { onOpen: () => void; onDemo: () => void; busy: boolean }) {
  return (
    <div className="landing">
      <div className="aurora" aria-hidden />
      <section className="hero">
        <span className="eyebrow">
          <Sparkles size={14} /> חדש · עורך ציונים חכם
        </span>
        <h1>
          מהגיליון של המשו״ב
          <br />
          <span className="grad">לסדין מודפס</span> — בשניות.
        </h1>
        <p className="lead">
          גוררים קובץ אקסל, מסדרים עמודות בגרירה, צובעים ציונים לפי טווחים ומדפיסים הכל על דף אחד.
        </p>
        <button className="dropzone" onClick={onOpen} disabled={busy}>
          <span className="dz-ic">
            <Upload size={26} />
          </span>
          <b>{busy ? "טוען…" : "גררו לכאן קובץ Excel או לחצו לבחירה"}</b>
          <small>xlsx · xls · csv · ods</small>
        </button>
        <button className="link center" onClick={onDemo}>
          או נסו עם נתוני הדגמה ←
        </button>
        <div className="features">
          <Feature icon={<Pencil size={18} />} title="עריכה כמו באקסל" text="הקלדה, ניווט בחיצים, ביטול וחזרה" />
          <Feature icon={<Columns3 size={18} />} title="גרירה והזזה" text="סידור, הסתרה, מיזוג ושינוי שם" />
          <Feature icon={<Palette size={18} />} title="צביעה לפי טווח" text="רמזור ציונים עם מקרא וספירה" />
          <Feature icon={<Printer size={18} />} title="דף אחד, מלא" text="התאמה אוטומטית לגודל וכיוון הדף" />
        </div>
        <p className="privacy">
          <ShieldCheck size={14} /> הקובץ נשאר במחשב שלכם — שום נתון לא נשלח לשרת.
        </p>
      </section>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="feature">
      <span className="f-ic">{icon}</span>
      <b>{title}</b>
      <small>{text}</small>
    </div>
  );
}
