import { useEffect } from 'react';
import type { Direction } from '../logic/directional';
import { useEditorStore } from '../store/editorStore';

const ARROWS: Record<string, Direction | undefined> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/** Global editor shortcuts. Ignored while typing in a field so text editing keeps native undo/copy/paste. */
export function useShortcuts(onSave: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditorStore.getState();
      if (st.previewOpen || st.popover) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') {
        e.preventDefault();
        onSave();
        return;
      }
      if (isTyping(e.target)) return;
      // Alt + arrow: connect the single selected node toward that direction (never while editing text).
      if (e.altKey && !mod && !e.shiftKey && ARROWS[e.key]) {
        if (st.connectDirectional(ARROWS[e.key] as Direction)) e.preventDefault(); // also blocks the browser's Alt+Left/Right "back"
        return;
      }
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        st.redo();
      } else if (mod && k === 'c') {
        st.copy();
      } else if (mod && k === 'v') {
        e.preventDefault();
        st.paste();
      } else if (mod && k === 'd') {
        e.preventDefault();
        st.duplicate();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        st.deleteSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave]);
}
