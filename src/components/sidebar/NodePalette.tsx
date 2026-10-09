import { useEditorStore } from '../../store/editorStore';
import { activeGraphOf } from '../../logic/projectOps';
import { PALETTE_MIME } from '../canvas/GraphCanvas';
import { NODE_META, PALETTE_ORDER } from '../canvas/nodeMeta';
import { Section } from '../ui/primitives';
import { Scroll } from '../ui/Motifs';

export function NodePalette() {
  const addNode = useEditorStore((s) => s.addNode);
  const hasStart = useEditorStore((s) => activeGraphOf(s.history.present).nodes.some((n) => n.type === 'start'));
  return (
    <Section title="Notes" icon={<Scroll size={18} />}>
      <p className="mb-2 text-xs text-text-sub">Click to add, or drag onto the canvas.</p>
      <ul className="grid grid-cols-2 gap-2">
        {PALETTE_ORDER.map((t) => {
          const m = NODE_META[t];
          const disabled = t === 'start' && hasStart;
          return (
            <li key={t}>
              <button
                type="button"
                disabled={disabled}
                draggable={!disabled}
                onDragStart={(e) => {
                  e.dataTransfer.setData(PALETTE_MIME, t);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addNode(t)}
                title={disabled ? 'This graph already has a Start node' : m.description}
                className={`group flex w-full items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-left text-[13px] font-semibold text-text transition hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${m.card}`}
              >
                <span className={`inline-flex h-6 w-6 flex-none items-center justify-center rounded-lg ${m.chip}`}>{m.icon}</span>
                <span className="flex-1 truncate">{m.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
