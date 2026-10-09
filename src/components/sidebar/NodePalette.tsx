import { useReactFlow } from '@xyflow/react';
import { useT } from '../../i18n';
import { NODE_W } from '../../logic/graphEdit';
import { useEditorStore } from '../../store/editorStore';
import { activeGraphOf } from '../../logic/projectOps';
import type { NodeType } from '../../model/types';
import { PALETTE_MIME } from '../canvas/GraphCanvas';
import { NODE_META, PALETTE_ORDER } from '../canvas/nodeMeta';
import { Section } from '../ui/primitives';
import { Scroll } from '../ui/Motifs';

export function NodePalette() {
  const t = useT();
  const rf = useReactFlow();
  const addNode = useEditorStore((s) => s.addNode);

  /** Add next to the selected node (so chains grow rightwards), else at the center of the visible canvas, then scroll it into view. */
  const addAtSensiblePlace = (type: NodeType) => {
    const g = activeGraphOf(useEditorStore.getState().history.present);
    const sel = g.nodes.filter((n) => n.selected);
    const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
    const center = canvas ? rf.screenToFlowPosition({ x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 }) : { x: 100, y: 100 };
    const only = sel.length === 1 ? sel[0] : undefined;
    const desired = only ? { x: only.position.x + NODE_W + 60, y: only.position.y } : { x: Math.round(center.x - NODE_W / 2), y: Math.round(center.y - 60) };
    const id = addNode(type, desired, true);
    if (!id || !canvas) return;
    const added = activeGraphOf(useEditorStore.getState().history.present).nodes.find((n) => n.id === id);
    if (!added) return;
    const vp = rf.getViewport();
    const left = added.position.x * vp.zoom + vp.x;
    const top = added.position.y * vp.zoom + vp.y;
    const outside = left < 0 || top < 0 || left + NODE_W * vp.zoom > canvas.width || top + 140 * vp.zoom > canvas.height;
    if (outside) void rf.setCenter(added.position.x + NODE_W / 2, added.position.y + 60, { zoom: vp.zoom, duration: 300 });
  };
  const hasStart = useEditorStore((s) => activeGraphOf(s.history.present).nodes.some((n) => n.type === 'start'));
  return (
    <Section title={t('palette.title')} icon={<Scroll size={18} />}>
      <p className="mb-2 text-xs text-text-sub">{t('palette.hint')}</p>
      <ul className="grid grid-cols-2 gap-2">
        {PALETTE_ORDER.map((tp) => {
          const m = NODE_META[tp];
          const disabled = tp === 'start' && hasStart;
          return (
            <li key={tp}>
              <button
                type="button"
                disabled={disabled}
                draggable={!disabled}
                onDragStart={(e) => {
                  e.dataTransfer.setData(PALETTE_MIME, tp);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addAtSensiblePlace(tp)}
                title={disabled ? t('palette.startExists') : t(`node.${tp}.desc`)}
                className={`group flex w-full items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-left text-[13px] font-semibold text-text transition hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${m.card}`}
              >
                <span className={`inline-flex h-6 w-6 flex-none items-center justify-center rounded-lg ${m.chip}`}>{m.icon}</span>
                <span className="flex-1 truncate">{t(`node.${tp}.label`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
