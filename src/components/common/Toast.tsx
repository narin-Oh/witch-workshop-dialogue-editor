import { useT } from '../../i18n';
import { useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { IconButton } from '../ui/primitives';
import { IconCheck, IconClose, IconError, Sparkle } from '../ui/Motifs';

const STYLE = { info: 'border-primary bg-primary-soft text-primary-deep', success: 'border-mint bg-mint-soft text-mint-deep', error: 'border-pink bg-pink-soft text-pink-deep' } as const;

/** Transient message (bottom center) plus persistent banners for autosave state. */
export function Notices() {
  const t = useT();
  const toast = useEditorStore((s) => s.toast);
  const autosaveError = useEditorStore((s) => s.autosaveError);
  const restored = useEditorStore((s) => s.restoredFromAutosave);
  const { notify, dismissRestored, loadSamples, newProject } = useEditorStore.getState();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => notify(null), toast.kind === 'error' ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [toast, notify]);

  return (
    <>
      {restored && (
        <div role="status" className="flex items-center gap-3 border-b border-mint bg-mint-soft px-4 py-1.5 text-[13px] text-mint-deep">
          <Sparkle size={16} /> {t('notice.restored')}
          <button type="button" className="ml-2 font-semibold underline" onClick={() => window.confirm(t('confirm.discardRestored')) && newProject()}>{t('notice.startEmpty')}</button>
          <button type="button" className="font-semibold underline" onClick={() => window.confirm(t('confirm.replaceRestored')) && loadSamples()}>{t('notice.loadSamples')}</button>
          <IconButton className="ml-auto" label={t('common.dismiss')} onClick={dismissRestored}><IconClose size={14} /></IconButton>
        </div>
      )}
      {autosaveError && (
        <div role="alert" className="flex items-center gap-2 border-b border-pink bg-pink-soft px-4 py-1.5 text-[13px] text-pink-deep">
          <IconError size={16} /> {t(autosaveError.key, autosaveError.params)}
        </div>
      )}
      {toast && (
        <div role={toast.kind === 'error' ? 'alert' : 'status'} className={`fixed bottom-14 left-1/2 z-[60] flex max-w-xl -translate-x-1/2 items-center gap-2 rounded-2xl border-2 px-4 py-2 text-[13px] font-semibold shadow-pop ${STYLE[toast.kind]}`}>
          {toast.kind === 'error' ? <IconError size={18} /> : <IconCheck size={18} />}
          {toast.text}
          <IconButton label={t('common.dismiss')} onClick={() => notify(null)}><IconClose size={14} /></IconButton>
        </div>
      )}
    </>
  );
}
