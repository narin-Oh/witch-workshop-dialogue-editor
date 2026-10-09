import { useEffect } from 'react';
import { saveAutosave } from '../io/autosave';
import { useEditorStore } from '../store/editorStore';

const DEBOUNCE_MS = 500;

/** Debounced autosave to localStorage, flushed immediately when the tab is hidden or closed. */
export function useAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    const flush = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (!pending) return;
      pending = false;
      const r = saveAutosave(useEditorStore.getState().history.present);
      const st = useEditorStore.getState();
      const err = r.ok ? null : (r.error ?? { key: 'autosave.failed', params: { name: 'Error' } });
      if (st.autosaveError?.key !== err?.key) st.setAutosaveError(err);
    };
    const unsub = useEditorStore.subscribe((s, prev) => {
      if (s.history.present === prev.history.present) return;
      pending = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    });
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      unsub();
      flush();
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
}
