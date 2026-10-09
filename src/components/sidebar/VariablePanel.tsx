import { useT } from '../../i18n';
import { activeGraphOf, variablesInUse } from '../../logic/projectOps';
import { defaultValueFor } from '../../logic/values';
import { selectProject, useEditorStore } from '../../store/editorStore';
import { TypeSelect, ValueInput } from '../common/ValueInput';
import { Button, IconButton, Section } from '../ui/primitives';
import { IconPlus, IconTrash, Leaf, Ribbon } from '../ui/Motifs';

export function VariablePanel() {
  const t = useT();
  const project = useEditorStore(selectProject);
  const { addVariable, patchVariable, deleteVariable } = useEditorStore.getState();
  const inUse = variablesInUse(activeGraphOf(project));
  return (
    <Section title={t('vars.title')} icon={<Leaf size={18} />}>
      <p className="mb-1 text-xs text-text-sub">{t('vars.helpGlobal')}</p>
      <p className="mb-2 text-xs text-text-sub">{t('vars.helpLocal')}</p>
      <ul className="space-y-2">
        {project.variables.map((v) => (
          <li key={v.id} className="rounded-xl border border-line bg-bg p-2">
            <div className="flex items-center gap-1">
              <span className={v.scope === 'global' ? 'text-yellow-deep' : 'text-mint-deep'} title={v.scope === 'global' ? t('vars.globalTip') : t('vars.localTip')}>
                {v.scope === 'global' ? <Ribbon size={16} /> : <Leaf size={16} />}
              </span>
              <input className="input !py-1 font-mono text-[13px]" aria-label={t('vars.name')} value={v.name} onChange={(e) => patchVariable(v.id, { name: e.target.value })} />
              <IconButton label={t('vars.delete', { name: v.name })} onClick={() => (!inUse.has(v.name) || window.confirm(t('confirm.deleteVar', { name: v.name }))) && deleteVariable(v.id)}>
                <IconTrash size={15} />
              </IconButton>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <TypeSelect label={t('vars.type')} value={v.type} onChange={(type) => patchVariable(v.id, { type, initialValue: defaultValueFor(type) })} />
              <select className="input" aria-label={t('vars.scope')} value={v.scope} onChange={(e) => patchVariable(v.id, { scope: e.target.value as 'global' | 'local' })}>
                <option value="global">{t('vars.global')}</option>
                <option value="local">{t('vars.local')}</option>
              </select>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="w-12 flex-none text-xs text-text-sub">{v.scope === 'global' ? t('vars.default') : t('vars.initial')}</span>
              <ValueInput label={t('vars.initialLabel')} type={v.type} value={v.initialValue} onChange={(initialValue) => patchVariable(v.id, { initialValue })} />
            </div>
          </li>
        ))}
        {project.variables.length === 0 && <li className="text-xs italic text-text-sub">{t('vars.none')}</li>}
      </ul>
      <Button className="mt-2 w-full" icon={<IconPlus size={14} />} onClick={addVariable}>{t('vars.add')}</Button>
    </Section>
  );
}
