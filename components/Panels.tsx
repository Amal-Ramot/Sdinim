"use client";
import { useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToParent } from "./dnd-modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  Calculator,
  Eye,
  EyeOff,
  GripVertical,
  Merge,
  Palette,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  WandSparkles,
} from "lucide-react";
import type { Col, Doc, Prefs, Rule } from "@/lib/model";
import { RULE_PRESETS, headerLabel, ruleCounts, uid, withIds } from "@/lib/model";
import { Segmented, Switch } from "./ui";
import type { Layout } from "./PrintPage";

// ================= Columns =================

function ColItem({
  col,
  selected,
  onSelect,
  onToggleHidden,
  onToggleColor,
  onRename,
}: {
  col: Col;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onToggleHidden: () => void;
  onToggleColor: () => void;
  onRename: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const lines = headerLabel(col.name, "clean").split("\n");
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`col-item${col.hidden ? " is-hidden" : ""}${isDragging ? " dragging" : ""}${selected ? " selected" : ""}`}
    >
      <button className="grip" {...attributes} {...listeners} aria-label="גרירה לשינוי סדר">
        <GripVertical size={16} />
      </button>
      <input type="checkbox" className="chk" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label="בחירה" />
      <button className="col-name" onDoubleClick={onRename} title={col.name} onClick={() => onSelect(!selected)}>
        <span>{lines[0]}</span>
        {lines.length > 1 && <small>{lines.slice(1).join(" · ")}</small>}
      </button>
      <button
        className={`icon-btn sm${col.color ? " accent" : ""}`}
        onClick={onToggleColor}
        title={col.color ? "צביעה פעילה" : "ללא צביעה"}
        aria-pressed={col.color}
      >
        <Palette size={15} />
      </button>
      <button className="icon-btn sm" onClick={onToggleHidden} title={col.hidden ? "הצג" : "הסתר"} aria-pressed={!col.hidden}>
        {col.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </li>
  );
}

export function ColumnsPanel({
  doc,
  commit,
  moveCol,
  onSmartClean,
  onMerge,
  onRename,
  onRecompute,
}: {
  doc: Doc;
  commit: (m: (d: Doc) => void) => void;
  moveCol: (a: string, b: string) => void;
  onSmartClean: () => void;
  onMerge: (ids: string[]) => void;
  onRename: (col: Col) => void;
  onRecompute: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) moveCol(String(e.active.id), String(e.over.id));
  };
  const sel = selected.filter((id) => doc.cols.some((c) => c.id === id));
  const setAll = (fn: (c: Col) => void) => commit((d) => d.cols.forEach(fn));
  const hiddenCount = doc.cols.filter((c) => c.hidden).length;

  return (
    <div className="panel">
      <button className="hero-action" onClick={onSmartClean}>
        <span className="hero-ic">
          <WandSparkles size={18} />
        </span>
        <span>
          <b>ניקוי חכם בלחיצה</b>
          <small>מסתיר עמודות ריקות, קבועות ות.ז, ומאחד קבוצות של אותו מקצוע</small>
        </span>
      </button>

      <div className="row-actions">
        <button className="chip" onClick={() => setAll((c) => (c.hidden = false))}>
          <Eye size={14} /> הצג הכל {hiddenCount > 0 && <em>{hiddenCount}</em>}
        </button>
        <button className="chip" onClick={onRecompute} title="חישוב מחדש של שורת הממוצע בתחתית">
          <Calculator size={14} /> חשב ממוצעים
        </button>
      </div>

      {sel.length > 0 && (
        <div className="selection-bar">
          <span>{sel.length} נבחרו</span>
          <button className="chip" disabled={sel.length < 2} onClick={() => (onMerge(sel), setSelected([]))}>
            <Merge size={14} /> מיזוג
          </button>
          <button className="chip" onClick={() => commit((d) => d.cols.forEach((c) => sel.includes(c.id) && (c.hidden = true)))}>
            <EyeOff size={14} /> הסתרה
          </button>
          <button
            className="chip danger"
            onClick={() => {
              commit((d) => (d.cols = d.cols.filter((c) => !sel.includes(c.id))));
              setSelected([]);
            }}
          >
            <Trash2 size={14} /> מחיקה
          </button>
          <button className="link" onClick={() => setSelected([])}>
            ביטול
          </button>
        </div>
      )}

      <p className="hint">גררו לשינוי סדר · לחיצה כפולה לשינוי שם · סמנו כמה עמודות כדי למזג</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToParent]}>
        <SortableContext items={doc.cols.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="col-list">
            {doc.cols.map((c) => (
              <ColItem
                key={c.id}
                col={c}
                selected={sel.includes(c.id)}
                onSelect={(v) => setSelected((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))}
                onToggleHidden={() => commit((d) => d.cols.forEach((x) => x.id === c.id && (x.hidden = !x.hidden)))}
                onToggleColor={() => commit((d) => d.cols.forEach((x) => x.id === c.id && (x.color = !x.color)))}
                onRename={() => onRename(c)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ================= Colors =================

export function ColorsPanel({
  doc,
  prefs,
  rows,
  update,
  commit,
}: {
  doc: Doc;
  prefs: Prefs;
  rows: number[];
  update: (p: Partial<Prefs>) => void;
  commit: (m: (d: Doc) => void) => void;
}) {
  const counts = ruleCounts(doc, prefs, rows);
  const setRule = (id: string, patch: Partial<Rule>) =>
    update({ rules: prefs.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const colored = doc.cols.filter((c) => c.color && !c.hidden).length;

  return (
    <div className="panel">
      <div className="presets">
        {Object.entries(RULE_PRESETS).map(([k, p]) => (
          <button key={k} className="preset" onClick={() => update({ rules: withIds(p.rules) })}>
            <span className="preset-swatches">
              {p.rules.map((r, i) => (
                <i key={i} style={{ background: r.bg }} />
              ))}
            </span>
            {p.name}
          </button>
        ))}
      </div>

      <h4 className="sub">טווחי צבע</h4>
      <ul className="rules">
        {prefs.rules.map((r) => (
          <li key={r.id} className="rule" style={{ ["--rb" as string]: r.bg, ["--rf" as string]: r.fg }}>
            <div className="rule-swatch">
              <label title="צבע רקע">
                <input type="color" value={r.bg} onChange={(e) => setRule(r.id, { bg: e.target.value })} />
              </label>
              <label title="צבע טקסט" className="fg">
                <input type="color" value={r.fg} onChange={(e) => setRule(r.id, { fg: e.target.value })} />
                A
              </label>
            </div>
            <div className="rule-body">
              <input
                className="rule-label"
                value={r.label}
                placeholder="תווית"
                onChange={(e) => setRule(r.id, { label: e.target.value })}
              />
              <div className="rule-range">
                <span>מ־</span>
                <input type="number" value={r.from} onChange={(e) => setRule(r.id, { from: Number(e.target.value) })} />
                <span>עד</span>
                <input type="number" value={r.to} onChange={(e) => setRule(r.id, { to: Number(e.target.value) })} />
              </div>
            </div>
            <span className="rule-count" title="מספר ציונים בטווח">
              {counts.get(r.id) || 0}
            </span>
            <button className="icon-btn sm" onClick={() => update({ rules: prefs.rules.filter((x) => x.id !== r.id) })} aria-label="מחיקת טווח">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn ghost wide"
        onClick={() => update({ rules: [...prefs.rules, { id: uid("r"), from: 0, to: 100, bg: "#e9d5ff", fg: "#581c87", label: "" }] })}
      >
        <Plus size={16} /> הוספת טווח
      </button>

      <h4 className="sub">אופן הצביעה</h4>
      <Segmented
        value={prefs.colorMode}
        onChange={(v) => update({ colorMode: v })}
        options={[
          { value: "bg", label: "רקע" },
          { value: "text", label: "טקסט" },
          { value: "both", label: "שניהם" },
        ]}
      />
      <Switch checked={prefs.round} onChange={(v) => update({ round: v })} label="עיגול לפני השוואה" hint="54.5 ייחשב 55" />

      <h4 className="sub">עמודות לצביעה ({colored})</h4>
      <div className="row-actions">
        <button className="chip" onClick={() => commit((d) => d.cols.forEach((c) => (c.color = true)))}>
          הכל
        </button>
        <button className="chip" onClick={() => commit((d) => d.cols.forEach((c) => (c.color = false)))}>
          אף אחת
        </button>
      </div>
      <div className="col-chips">
        {doc.cols
          .filter((c) => !c.hidden)
          .map((c) => (
            <button
              key={c.id}
              className={`tag${c.color ? " on" : ""}`}
              onClick={() => commit((d) => d.cols.forEach((x) => x.id === c.id && (x.color = !x.color)))}
            >
              {headerLabel(c.name, "first")}
            </button>
          ))}
      </div>
    </div>
  );
}

// ================= Print =================

export function PrintPanel({
  doc,
  prefs,
  update,
  commit,
  layout,
  onPrint,
}: {
  doc: Doc;
  prefs: Prefs;
  update: (p: Partial<Prefs>) => void;
  commit: (m: (d: Doc) => void) => void;
  layout: Layout | null;
  onPrint: () => void;
}) {
  return (
    <div className="panel">
      <div className="fit-meter">
        <div>
          <small>קנה מידה</small>
          <b>{layout ? Math.round(layout.zoom * 100) : "—"}%</b>
        </div>
        <div>
          <small>כיוון</small>
          <b>{layout ? (layout.orient === "landscape" ? "לרוחב" : "לאורך") : "—"}</b>
        </div>
        <div>
          <small>עמודים</small>
          <b>1</b>
        </div>
      </div>

      <label className="lbl">כותרת</label>
      <input className="field" value={doc.title} onChange={(e) => commit((d) => (d.title = e.target.value))} />
      <label className="lbl">שורת משנה</label>
      <input
        className="field"
        value={prefs.subtitle}
        placeholder="למשל: מחנך/ת, תאריך, תקופה"
        onChange={(e) => update({ subtitle: e.target.value })}
      />

      <label className="lbl">גודל דף</label>
      <Segmented
        value={prefs.paper}
        onChange={(v) => update({ paper: v })}
        options={[
          { value: "A4", label: "A4" },
          { value: "A3", label: "A3" },
          { value: "Letter", label: "Letter" },
        ]}
      />
      <label className="lbl">כיוון</label>
      <Segmented
        value={prefs.orient}
        onChange={(v) => update({ orient: v })}
        options={[
          { value: "auto", label: "אוטומטי" },
          { value: "portrait", label: "לאורך" },
          { value: "landscape", label: "לרוחב" },
        ]}
      />
      <label className="lbl">
        שוליים <span className="val">{prefs.margin} מ״מ</span>
      </label>
      <input type="range" min={0} max={25} value={prefs.margin} onChange={(e) => update({ margin: Number(e.target.value) })} />

      <label className="lbl">צפיפות</label>
      <Segmented
        value={prefs.density}
        onChange={(v) => update({ density: v })}
        options={[
          { value: "compact", label: "צפוף" },
          { value: "normal", label: "רגיל" },
          { value: "airy", label: "מרווח" },
        ]}
      />
      <label className="lbl">כותרות עמודות</label>
      <Segmented
        value={prefs.headerMode}
        onChange={(v) => update({ headerMode: v })}
        options={[
          { value: "full", label: "מלא" },
          { value: "clean", label: "ללא קודים" },
          { value: "first", label: "שורה ראשונה" },
        ]}
      />

      <div className="switches">
        <Switch checked={prefs.fill} onChange={(v) => update({ fill: v })} label="מתיחה למילוי כל הדף" hint="הטבלה תכסה את כל שטח ההדפסה" />
        <Switch checked={prefs.vertical} onChange={(v) => update({ vertical: v })} label="כותרות ציונים אנכיות" hint="חוסך רוחב ומגדיל את הטבלה" />
        <Switch checked={prefs.zebra} onChange={(v) => update({ zebra: v })} label="פסי זברה" />
        <Switch checked={prefs.showTitle} onChange={(v) => update({ showTitle: v })} label="הצגת כותרת" />
        <Switch checked={prefs.showLegend} onChange={(v) => update({ showLegend: v })} label="מקרא צבעים" />
      </div>

      <button className="btn primary wide big" onClick={onPrint}>
        <Printer size={18} /> הדפסה על דף אחד
      </button>
      <button className="link center" onClick={() => update({ margin: 8, fill: true, orient: "auto", density: "normal" })}>
        <RotateCcw size={13} /> איפוס הגדרות הדפסה
      </button>
    </div>
  );
}
