import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

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
      if (st.previewOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') {
        e.preventDefault();
        onSave();
        return;
      }
      if (isTyping(e.target)) return;
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
