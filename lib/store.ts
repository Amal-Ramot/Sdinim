"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc, Prefs } from "./model";
import { DEFAULT_PREFS } from "./model";

const LIMIT = 150;

/** Document state with full undo/redo history. */
export function useHistory() {
  const [state, setState] = useState<{ past: Doc[]; present: Doc | null; future: Doc[] }>({
    past: [],
    present: null,
    future: [],
  });

  const commit = useCallback((mut: (d: Doc) => void) => {
    setState((s) => {
      if (!s.present) return s;
      const next = structuredClone(s.present);
      mut(next);
      return { past: [...s.past, s.present].slice(-LIMIT), present: next, future: [] };
    });
  }, []);

  const reset = useCallback((doc: Doc | null) => setState({ past: [], present: doc, future: [] }), []);

  const undo = useCallback(
    () =>
      setState((s) =>
        s.past.length && s.present
          ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }
          : s,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      setState((s) =>
        s.future.length && s.present
          ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
          : s,
      ),
    [],
  );

  return {
    doc: state.present,
    commit,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

const PREFS_KEY = "sdinim.prefs.v2";

/** User preferences (color rules, print setup) persisted per browser. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);
  const update = useCallback((patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  return { prefs, update, setPrefs };
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    let t: "light" | "dark" = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    try {
      const s = localStorage.getItem("sdinim.theme");
      if (s === "light" || s === "dark") t = s;
    } catch {}
    setTheme(t);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () =>
    setTheme((t) => {
      const n = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("sdinim.theme", n);
      } catch {}
      return n;
    });
  return { theme, toggle };
}
