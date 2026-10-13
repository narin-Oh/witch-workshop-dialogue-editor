import { useT } from '../../i18n';
import { selectProject, useEditorStore } from '../../store/editorStore';
import { IconButton, Section } from '../ui/primitives';
import { IconPlus, IconTrash, Ribbon } from '../ui/Motifs';

export function GraphList() {
  const t = useT();
  const project = useEditorStore(selectProject);
  const { addGraph, renameGraph, deleteGraph, setActiveGraph } = useEditorStore.getState();
  return (
    <Section title={t('graphs.title')} icon={<Ribbon size={18} />} action={<IconButton label={t('graphs.add')} onClick={addGraph}><IconPlus size={16} /></IconButton>}>
      <ul className="space-y-1.5">
        {project.graphs.map((g) => {
          const active = g.id === project.activeGraphId;
          return (
            <li key={g.id} className={`flex items-center gap-1 rounded-xl border px-1.5 py-1 ${active ? 'border-primary-deep/60 bg-primary-soft' : 'border-transparent hover:bg-primary-soft/60'}`}>
              <button type="button" aria-label={t('graphs.open', { name: g.name })} aria-current={active} onClick={() => setActiveGraph(g.id)} className={`h-6 w-1.5 flex-none rounded-full ${active ? 'bg-primary-deep' : 'bg-line'}`} />
              <input className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-[13px] font-semibold focus:rounded-md focus:bg-panel" aria-label={t('graphs.nameLabel')} value={g.name} onFocus={() => setActiveGraph(g.id)} onChange={(e) => renameGraph(g.id, e.target.value)} />
              <IconButton label={t('graphs.delete', { name: g.name })} disabled={project.graphs.length <= 1} onClick={() => window.confirm(t('confirm.deleteGraph', { name: g.name })) && deleteGraph(g.id)}>
                <IconTrash size={15} />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
