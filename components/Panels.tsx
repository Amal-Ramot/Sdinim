"use client";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToParent } from "./dnd-modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { Col, Doc, Prefs, Rule } from "@/lib/model";
import { RULE_PRESETS, headerLabel, ruleCounts, uid, withIds } from "@/lib/model";
import { Segmented, Switch } from "./ui";
import type { Layout } from "./PrintPage";

// ================= Columns =================

function ColItem({ col, onToggleHidden, onRename }: { col: Col; onToggleHidden: () => void; onRename: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const lines = headerLabel(col.name, "clean").split("\n");
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`col-item${col.hidden ? " is-hidden" : ""}${isDragging ? " dragging" : ""}`}
    >
      <button className="grip" {...attributes} {...listeners} aria-label="גרירה לשינוי סדר">
        <GripVertical size={16} />
      </button>
      <button className="col-name" onDoubleClick={onRename} title={col.name}>
        <span>{lines[0]}</span>
        {lines.length > 1 && <small>{lines.slice(1).join(" · ")}</small>}
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
  onRename,
}: {
  doc: Doc;
  commit: (m: (d: Doc) => void) => void;
  moveCol: (a: string, b: string) => void;
  onRename: (col: Col) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) moveCol(String(e.active.id), String(e.over.id));
  };
  const hiddenCount = doc.cols.filter((c) => c.hidden).length;

  return (
    <div className="panel">
      <div className="row-actions">
        <button className="chip" onClick={() => commit((d) => d.cols.forEach((c) => (c.hidden = false)))}>
          <Eye size={14} /> הצג הכל {hiddenCount > 0 && <em>{hiddenCount}</em>}
        </button>
      </div>

      <p className="hint">גררו לשינוי סדר · לחיצה כפולה לשינוי שם · העין מסתירה או מציגה</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToParent]}>
        <SortableContext items={doc.cols.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="col-list">
            {doc.cols.map((c) => (
              <ColItem
                key={c.id}
                col={c}
                onToggleHidden={() => commit((d) => d.cols.forEach((x) => x.id === c.id && (x.hidden = !x.hidden)))}
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
  const rules = prefs.rules;
  const setRules = (next: Rule[]) => update({ rules: next });
  const setRule = (id: string, patch: Partial<Rule>) => setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
        {rules.map((r) => (
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
            <span className="rule-count" title="מספר תאים בטווח">
              {counts.get(r.id) || 0}
            </span>
            <button className="icon-btn sm" onClick={() => setRules(rules.filter((x) => x.id !== r.id))} aria-label="מחיקת טווח">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn ghost wide"
        onClick={() => setRules([...rules, { id: uid("r"), from: 0, to: 100, bg: "#e9d5ff", fg: "#581c87", label: "" }])}
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
