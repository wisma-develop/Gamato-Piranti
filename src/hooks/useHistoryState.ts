import { useCallback, useEffect, useRef, useState } from "react";

// ─── Generic Undo/Redo history manager ─────────────────────────────────────
// Used across editing tools (Certificate/CV/Invoice/Kwitansi/Struk/Business
// Card generators, QR & Barcode Studio, Image editors, etc.) so every tool
// that lets the user change something gets a real Undo/Redo stack, without
// re-implementing the bookkeeping in each component.
//
// Usage pattern:
//   const history = useHistoryState(initialState);
//   history.state              // current value
//   history.set(next)          // discrete action → commits immediately
//   history.set(next, { commit: false }) + history.commit()  // debounced
//   history.undo() / history.redo()
//   history.canUndo / history.canRedo

export interface UseHistoryStateOptions {
  /** Max number of undoable steps kept in memory. Default 100. */
  limit?: number;
}

export interface UseHistoryStateReturn<T> {
  state: T;
  /**
   * Update the state. By default this immediately snapshots the previous
   * value onto the undo stack (good for discrete actions: button clicks,
   * toggles, dropdown/select changes, drag end).
   * Pass `{ commit: false }` while a batch of rapid changes is in progress
   * (e.g. every keystroke while typing, or every pixel while dragging a
   * slider) — call `commit()` once the user pauses to record that whole
   * batch as a single undoable step instead of one step per keystroke.
   */
  set: (updater: T | ((prev: T) => T), opts?: { commit?: boolean }) => void;
  /** Flush a pending (debounced) change into the undo stack right now. */
  commit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Replace the state and clear all history (e.g. when loading a template). */
  reset: (value: T) => void;
}

export function useHistoryState<T>(initial: T | (() => T), options: UseHistoryStateOptions = {}): UseHistoryStateReturn<T> {
  const limit = options.limit ?? 100;
  const [state, setState] = useState<T>(initial);
  // Kept in sync with `state` synchronously (not just after re-render) so
  // `set()` always reads the true latest value even when called multiple
  // times in the same event handler. This also keeps the history bookkeeping
  // as a plain side effect *outside* the setState updater — updater
  // functions passed to setState should stay pure, since React (especially
  // in StrictMode / concurrent rendering) may invoke them more than once.
  const stateRef = useRef<T>(state);
  stateRef.current = state;

  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const pendingBase = useRef<T | null>(null);
  const hasPending = useRef(false);
  const [, forceTick] = useState(0);
  const bump = useCallback(() => forceTick((x) => (x + 1) % 1_000_000), []);

  const pushPast = useCallback(
    (value: T) => {
      past.current.push(value);
      if (past.current.length > limit) past.current.shift();
    },
    [limit]
  );

  const set = useCallback(
    (updater: T | ((prev: T) => T), opts?: { commit?: boolean }) => {
      const prev = stateRef.current;
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      if (opts?.commit === false) {
        if (!hasPending.current) {
          pendingBase.current = prev;
          hasPending.current = true;
        }
      } else {
        const base = hasPending.current ? (pendingBase.current as T) : prev;
        pushPast(base);
        hasPending.current = false;
        pendingBase.current = null;
        future.current = [];
      }
      stateRef.current = next;
      setState(next);
    },
    [pushPast]
  );

  const commit = useCallback(() => {
    if (hasPending.current) {
      pushPast(pendingBase.current as T);
      hasPending.current = false;
      pendingBase.current = null;
      future.current = [];
      bump();
    }
  }, [pushPast, bump]);

  const undo = useCallback(() => {
    commit();
    if (!past.current.length) return;
    const last = past.current.pop() as T;
    future.current.push(stateRef.current);
    stateRef.current = last;
    setState(last);
  }, [commit]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current.pop() as T;
    past.current.push(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const reset = useCallback(
    (value: T) => {
      past.current = [];
      future.current = [];
      pendingBase.current = null;
      hasPending.current = false;
      stateRef.current = value;
      setState(value);
      bump();
    },
    [bump]
  );

  return {
    state,
    set,
    commit,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0 || hasPending.current,
    canRedo: future.current.length > 0,
  };
}

/**
 * Helper for continuous inputs (typing, slider drag): call the returned
 * function on every change (with `commit: false` already applied by the
 * caller) and it will auto-commit the batch into history after a pause.
 */
export function useDebouncedCommit(commitFn: () => void, delayMs = 600) {
  const timer = useRef<number | null>(null);

  const schedule = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      commitFn();
      timer.current = null;
    }, delayMs);
  }, [commitFn, delayMs]);

  const flushNow = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    commitFn();
  }, [commitFn]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return { schedule, flushNow };
}
