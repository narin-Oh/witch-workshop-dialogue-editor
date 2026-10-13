import { useReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { outputHandles } from '../../logic/graphUtils';
import { activeGraphOf } from '../../logic/projectOps';
import { nodeParams } from '../../logic/validation';
import type { EditorNode } from '../../model/types';
import { selectProject, useEditorStore } from '../../store/editorStore';
import { NODE_W } from '../../logic/graphEdit';

interface Item {
  id: string;
  label: string;
  detail?: string;
}

/**
 * Choice menu used by keyboard connecting (which output of a multi-output node?) and by handle double-click
 * (which of several incoming connections to remove?). Operable with ↑ ↓ Enter, number keys, Esc, or the mouse.
 */
export function ConnectionPopover() {
  const t = useT();
  const rf = useReactFlow();
  const popover = useEditorStore((s) => s.popover);
  const graph = useEditorStore((s) => activeGraphOf(selectProject(s)));
  const { pickPopover, closePopover } = useEditorStore.getState();
  const [active, setActive] = useState(0);

  const view = useMemo(() => {
    if (!popover) return null;
    const ref = (n: EditorNode | undefined) => (n ? t('connect.nodeRef', nodeParams(n)) : '?');
    const byId = (id: string) => graph.nodes.find((n) => n.id === id);
    if (popover.kind === 'output') {
      const source = byId(popover.sourceId);
      const target = byId(popover.targetId);
      if (!source || !target) return null;
      const items: Item[] = outputHandles(source).map((h, i) => {
        const label =
          source.type === 'choice'
            ? t('connect.choiceItem', { n: i + 1, text: source.data.choices[i]?.text || t('card.emptyChoice') })
            : source.type === 'condition'
              ? t(h.id === 'true' ? 'card.true' : 'card.false')
              : h.label;
        const existing = graph.edges.find((e) => e.source === source.id && e.sourceHandle === h.id);
        return { id: h.id, label, detail: existing ? t('connect.currently', { to: ref(byId(existing.target)) }) : undefined };
      });
      const p = rf.flowToScreenPosition({ x: source.position.x + (source.measured?.width ?? NODE_W) + 12, y: source.position.y });
      return { title: t('connect.pickOutput', { to: ref(target) }), items, x: p.x, y: p.y };
    }
    const items: Item[] = popover.edgeIds.flatMap((id) => {
      const e = graph.edges.find((x) => x.id === id);
      return e ? [{ id, label: t('connect.edgeItem', { from: ref(byId(e.source)), to: ref(byId(e.target)) }) }] : [];
    });
    return { title: t('connect.pickEdge'), items, x: popover.point.x, y: popover.point.y };
  }, [popover, graph, rf, t]);

  useEffect(() => setActive(0), [popover]);

  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      const items = view?.items ?? [];
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'Escape') {
        stop();
        closePopover();
      } else if (e.key === 'ArrowDown') {
        stop();
        setActive((a) => (a + 1) % Math.max(items.length, 1));
      } else if (e.key === 'ArrowUp') {
        stop();
        setActive((a) => (a - 1 + items.length) % Math.max(items.length, 1));
      } else if (e.key === 'Enter') {
        stop();
        const it = items[active];
        if (it) pickPopover(it.id);
      } else if (/^[1-9]$/.test(e.key)) {
        stop();
        const it = items[Number(e.key) - 1];
        if (it) pickPopover(it.id);
      }
    };
    window.addEventListener('keydown', onKey, true); // capture: runs before the global editor shortcuts
    return () => window.removeEventListener('keydown', onKey, true);
  }, [popover, view, active, closePopover, pickPopover]);

  if (!popover || !view) return null;
  const left = Math.max(8, Math.min(view.x, window.innerWidth - 320));
  const top = Math.max(8, Math.min(view.y, window.innerHeight - 60 - view.items.length * 48));
  return (
    <div className="fixed inset-0 z-40" onPointerDown={closePopover} onContextMenu={(e) => { e.preventDefault(); closePopover(); }}>
      <div
        role="menu"
        aria-label={view.title}
        style={{ left, top }}
        className="absolute w-[300px] rounded-2xl border border-line bg-panel p-2 shadow-pop"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="px-2 pb-1 pt-0.5 text-xs font-semibold text-text-sub">{view.title}</p>
        {view.items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            onMouseEnter={() => setActive(i)}
            onClick={() => pickPopover(it.id)}
            className={`flex w-full flex-col rounded-xl px-3 py-1.5 text-left text-[13px] ${i === active ? 'bg-primary-soft ring-2 ring-primary-deep/60' : 'hover:bg-primary-soft'}`}
          >
            <span className="font-semibold">{it.label}</span>
            {it.detail && <span className="text-xs text-text-sub">{it.detail}</span>}
          </button>
        ))}
        <p className="px-2 pt-1 text-[11px] text-text-sub">{t('connect.hint')}</p>
      </div>
    </div>
  );
}
