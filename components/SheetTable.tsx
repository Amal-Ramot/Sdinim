"use client";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, EllipsisVertical } from "lucide-react";
import type { Col, Doc, Prefs } from "@/lib/model";
import { cellColors, fmt, headerLabel, normalizeInput } from "@/lib/model";

interface Props {
  doc: Doc;
  prefs: Prefs;
  rows: number[];
  commit: (m: (d: Doc) => void) => void;
  onHeaderMenu: (col: Col, x: number, y: number) => void;
  onCellMenu: (col: Col, row: number, x: number, y: number) => void;
  moveCol: (activeId: string, overId: string) => void;
}

function SortableTh({
  col,
  prefs,
  sort,
  onMenu,
}: {
  col: Col;
  prefs: Prefs;
  sort: 1 | -1 | 0;
  onMenu: (e: RMouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform ? { ...transform, y: 0 } : null),
    transition,
    zIndex: isDragging ? 5 : undefined,
  };
  const vertical = prefs.vertical && col.color;
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "dragging" : ""}${col.color ? " grade" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e);
      }}
      {...attributes}
      {...listeners}
      title="גררו כדי להזיז · לחיצה ימנית לאפשרויות"
    >
      <div className={`th-in${vertical ? " vertical" : ""}`}>
        <span className="th-label">{headerLabel(col.name, prefs.headerMode)}</span>
        {sort !== 0 && (sort === 1 ? <ArrowUpNarrowWide size={13} className="th-sort" /> : <ArrowDownWideNarrow size={13} className="th-sort" />)}
      </div>
      <button
        className="th-menu"
        aria-label="אפשרויות עמודה"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onMenu(e);
        }}
      >
        <EllipsisVertical size={14} />
      </button>
    </th>
  );
}

export default function SheetTable({ doc, prefs, rows, commit, onHeaderMenu, onCellMenu, moveCol }: Props) {
  const vis = doc.cols.filter((c) => !c.hidden);
  const [sel, setSel] = useState<{ ri: number; ci: number } | null>(null);
  const [edit, setEdit] = useState<{ ri: number; ci: number; draft: string } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!sel) return;
    wrap.current?.querySelector(`[data-k="${sel.ri}:${sel.ci}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel]);

  useEffect(() => {
    if (sel && (sel.ri >= rows.length || sel.ci >= vis.length)) setSel(null);
  }, [rows.length, vis.length, sel]);

  const editRef = useRef(edit);
  editRef.current = edit;

  const commitEdit = (move?: [number, number]) => {
    const edit = editRef.current;
    if (!edit) return;
    editRef.current = null;
    const col = vis[edit.ci];
    const r = rows[edit.ri];
    const old = fmt(col?.cells[r]);
    if (col && edit.draft !== old) {
      commit((d) => {
        const c = d.cols.find((x) => x.id === col.id);
        if (c) c.cells[r] = normalizeInput(edit.draft);
      });
    }
    setEdit(null);
    if (move) setSel({ ri: clamp(edit.ri + move[0], rows.length), ci: clamp(edit.ci + move[1], vis.length) });
    requestAnimationFrame(() => wrap.current?.focus({ preventScroll: true }));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (edit || !sel) return;
    const mv = (dr: number, dc: number) => {
      e.preventDefault();
      setSel({ ri: clamp(sel.ri + dr, rows.length), ci: clamp(sel.ci + dc, vis.length) });
    };
    switch (e.key) {
      case "ArrowDown":
        return mv(1, 0);
      case "ArrowUp":
        return mv(-1, 0);
      case "ArrowLeft":
        return mv(0, 1); // RTL: left = next column
      case "ArrowRight":
        return mv(0, -1);
      case "Tab":
        return mv(0, e.shiftKey ? -1 : 1);
      case "Enter":
      case "F2":
        e.preventDefault();
        setEdit({ ...sel, draft: fmt(vis[sel.ci].cells[rows[sel.ri]]) });
        return;
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        const col = vis[sel.ci];
        const r = rows[sel.ri];
        commit((d) => {
          const c = d.cols.find((x) => x.id === col.id);
          if (c) c.cells[r] = "";
        });
        return;
      }
      case "Escape":
        setSel(null);
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setEdit({ ...sel, draft: e.key });
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) moveCol(String(e.active.id), String(e.over.id));
  };

  return (
    <div className="sheet-scroll" ref={wrap} tabIndex={0} onKeyDown={onKey} aria-label="טבלת נתונים">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className={`sheet sheet-edit density-${prefs.density}${prefs.zebra ? " zebra" : ""}`}>
          <thead>
            <SortableContext items={vis.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              <tr>
                {vis.map((c) => (
                  <SortableTh
                    key={c.id}
                    col={c}
                    prefs={prefs}
                    sort={doc.sort?.id === c.id ? doc.sort.dir : 0}
                    onMenu={(e) => onHeaderMenu(c, e.clientX, e.clientY)}
                  />
                ))}
              </tr>
            </SortableContext>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r} className={doc.summary[r] ? "summary" : undefined}>
                {vis.map((c, ci) => {
                  const v = c.cells[r];
                  const isSel = sel?.ri === ri && sel?.ci === ci;
                  const isEdit = edit?.ri === ri && edit?.ci === ci;
                  const colors = cellColors(prefs, c, v);
                  return (
                    <td
                      key={c.id}
                      data-k={`${ri}:${ci}`}
                      className={`${isSel ? "sel" : ""}${colors ? " tinted" : ""}`}
                      style={colors ?? undefined}
                      onMouseDown={() => {
                        if (!isEdit) setSel({ ri, ci });
                      }}
                      onDoubleClick={() => setEdit({ ri, ci, draft: fmt(v) })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSel({ ri, ci });
                        onCellMenu(c, r, e.clientX, e.clientY);
                      }}
                    >
                      {isEdit ? (
                        <input
                          autoFocus
                          className="cell-input"
                          value={edit.draft}
                          onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
                          onBlur={() => commitEdit()}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") commitEdit([1, 0]);
                            else if (e.key === "Tab") {
                              e.preventDefault();
                              commitEdit([0, e.shiftKey ? -1 : 1]);
                            } else if (e.key === "Escape") {
                              editRef.current = null;
                              setEdit(null);
                              wrap.current?.focus();
                            }
                          }}
                        />
                      ) : (
                        fmt(v)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}

const clamp = (v: number, n: number) => Math.max(0, Math.min(n - 1, v));
