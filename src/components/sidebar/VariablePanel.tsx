import { activeGraphOf, variablesInUse } from '../../logic/projectOps';
import { defaultValueFor } from '../../logic/values';
import { selectProject, useEditorStore } from '../../store/editorStore';
import { TypeSelect, ValueInput } from '../common/ValueInput';
import { Button, IconButton, Section } from '../ui/primitives';
import { IconPlus, IconTrash, Leaf, Ribbon } from '../ui/Motifs';

export function VariablePanel() {
  const project = useEditorStore(selectProject);
  const { addVariable, patchVariable, deleteVariable } = useEditorStore.getState();
  const inUse = variablesInUse(activeGraphOf(project));
  return (
    <Section title="Variables" icon={<Leaf size={18} />}>
      <p className="mb-2 text-xs text-text-sub">
        <b>Global</b> variables persist in the game save and are never reset by a conversation. <b>Local</b> variables exist for one conversation only.
      </p>
      <ul className="space-y-2">
        {project.variables.map((v) => (
          <li key={v.id} className="rounded-xl border border-line bg-bg p-2">
            <div className="flex items-center gap-1">
              <span className={v.scope === 'global' ? 'text-yellow-deep' : 'text-mint-deep'} title={v.scope === 'global' ? 'Global (persistent)' : 'Local (this conversation)'}>
                {v.scope === 'global' ? <Ribbon size={16} /> : <Leaf size={16} />}
              </span>
              <input className="input !py-1 font-mono text-[13px]" aria-label="Variable name" value={v.name} onChange={(e) => patchVariable(v.id, { name: e.target.value })} />
              <IconButton label={`Delete ${v.name}`} onClick={() => (!inUse.has(v.name) || window.confirm(`"${v.name}" is used by nodes in this graph. Delete anyway?`)) && deleteVariable(v.id)}>
                <IconTrash size={15} />
              </IconButton>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <TypeSelect label="Type" value={v.type} onChange={(type) => patchVariable(v.id, { type, initialValue: defaultValueFor(type) })} />
              <select className="input" aria-label="Scope" value={v.scope} onChange={(e) => patchVariable(v.id, { scope: e.target.value as 'global' | 'local' })}>
                <option value="global">global</option>
                <option value="local">local</option>
              </select>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="w-12 flex-none text-xs text-text-sub">{v.scope === 'global' ? 'Default' : 'Initial'}</span>
              <ValueInput label="Initial value" type={v.type} value={v.initialValue} onChange={(initialValue) => patchVariable(v.id, { initialValue })} />
            </div>
          </li>
        ))}
        {project.variables.length === 0 && <li className="text-xs italic text-text-sub">No variables yet.</li>}
      </ul>
      <Button className="mt-2 w-full" icon={<IconPlus size={14} />} onClick={addVariable}>Add variable</Button>
    </Section>
  );
}
