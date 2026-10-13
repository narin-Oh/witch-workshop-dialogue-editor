import { useT } from '../../i18n';
import { newChoice, paramsForEvent } from '../../model/factory';
import { newId } from '../../model/ids';
import { EVENT_CATALOG, findEventSpec } from '../../model/eventCatalog';
import { operationsFor, operatorsFor, coerceValue, defaultValueFor } from '../../logic/values';
import { DISPLAY_MODES, type DisplayMode, type EditorNode, type EventParam, type NodeData, type VariableDef } from '../../model/types';
import { TypeSelect, ValueInput } from '../common/ValueInput';
import { Button, Field, IconButton } from '../ui/primitives';
import { IconDown, IconPlus, IconTrash, IconUp } from '../ui/Motifs';

type Of<T extends EditorNode['type']> = Extract<EditorNode, { type: T }>['data'];
/** Update callback: patches node data; `key` coalesces rapid edits (typing) into one undo step. */
export type Patch<T> = (fn: (d: T) => T, key?: string) => void;

export function StartForm({ data, patch }: { data: Of<'start'>; patch: Patch<Of<'start'>> }) {
  const t = useT();
  return (
    <Field label={t('start.note')} hint={t('start.noteHint')}>
      <textarea className="input min-h-[72px]" value={data.note} onChange={(e) => patch((d) => ({ ...d, note: e.target.value }), 'note')} />
    </Field>
  );
}

export function DialogueForm({ data, patch }: { data: Of<'dialogue'>; patch: Patch<Of<'dialogue'>> }) {
  const t = useT();
  const set = <K extends keyof Of<'dialogue'>>(k: K) => (v: Of<'dialogue'>[K]) => patch((d) => ({ ...d, [k]: v }), String(k));
  const character = data.displayMode === 'character';
  return (
    <>
      <Field label={t('dialogue.mode')} hint={t(`dialogue.modeHint.${data.displayMode}`)}>
        <select className="input" aria-label={t('dialogue.mode')} value={data.displayMode} onChange={(e) => patch((d) => ({ ...d, displayMode: e.target.value as DisplayMode }))}>
          {DISPLAY_MODES.map((m) => <option key={m} value={m}>{t(`dialogue.mode.${m}`)}</option>)}
        </select>
      </Field>
      {character && (
        <>
          <Field label={t('dialogue.speaker')}><input className="input" value={data.speaker} onChange={(e) => set('speaker')(e.target.value)} placeholder={t('dialogue.speakerPh')} /></Field>
          <Field label={t('dialogue.override')} hint={t('dialogue.overrideHint')}><input className="input" value={data.speakerOverride} onChange={(e) => set('speakerOverride')(e.target.value)} /></Field>
        </>
      )}
      <Field label={t('dialogue.text')}><textarea className="input min-h-[120px] leading-relaxed" value={data.text} onChange={(e) => set('text')(e.target.value)} /></Field>
      {character && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('dialogue.portrait')}><input className="input" value={data.portraitId} onChange={(e) => set('portraitId')(e.target.value)} /></Field>
          <Field label={t('dialogue.expression')}><input className="input" value={data.expression} onChange={(e) => set('expression')(e.target.value)} /></Field>
        </div>
      )}
    </>
  );
}

export function ChoiceForm({ data, patch }: { data: Of<'choice'>; patch: Patch<Of<'choice'>> }) {
  const t = useT();
  const move = (i: number, dir: -1 | 1) =>
    patch((d) => {
      const list = [...d.choices];
      const j = i + dir;
      if (j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j]!, list[i]!];
      return { ...d, choices: list };
    });
  return (
    <>
      <p className="label">{t('choice.title')}</p>
      <ol className="space-y-2">
        {data.choices.map((c, i) => (
          <li key={c.id} className="rounded-xl border border-line bg-bg p-2">
            <div className="flex items-start gap-1.5">
              <span className="mt-1.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-yellow text-xs font-bold text-yellow-deep">{i + 1}</span>
              <textarea
                className="input min-h-[52px]"
                aria-label={t('choice.text', { n: i + 1 })}
                value={c.text}
                onChange={(e) => patch((d) => ({ ...d, choices: d.choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) }), `choice-${c.id}`)}
              />
            </div>
            <div className="mt-1 flex justify-end gap-0.5">
              <IconButton label={t('choice.up')} disabled={i === 0} onClick={() => move(i, -1)}><IconUp size={16} /></IconButton>
              <IconButton label={t('choice.down')} disabled={i === data.choices.length - 1} onClick={() => move(i, 1)}><IconDown size={16} /></IconButton>
              <IconButton label={t('choice.delete')} onClick={() => patch((d) => ({ ...d, choices: d.choices.filter((x) => x.id !== c.id) }))}><IconTrash size={16} /></IconButton>
            </div>
          </li>
        ))}
      </ol>
      <Button className="mt-2" icon={<IconPlus size={14} />} onClick={() => patch((d) => ({ ...d, choices: [...d.choices, newChoice('')] }))}>{t('choice.add')}</Button>
      <p className="mt-2 text-xs text-text-sub">{t('choice.hint')}</p>
    </>
  );
}

function VariableSelect({ variables, value, onChange }: { variables: VariableDef[]; value: string; onChange: (name: string) => void }) {
  const t = useT();
  const known = variables.some((v) => v.name === value);
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('common.choose')}</option>
      {!known && value && <option value={value}>{value} {t('cond.undefinedSuffix')}</option>}
      {variables.map((v) => (
        <option key={v.id} value={v.name}>{v.name} ({t(`vars.${v.scope}`)} {v.type})</option>
      ))}
    </select>
  );
}

export function ConditionForm({ data, patch, variables }: { data: Of<'condition'>; patch: Patch<Of<'condition'>>; variables: VariableDef[] }) {
  const t = useT();
  const def = variables.find((v) => v.name === data.variable);
  const pick = (name: string) =>
    patch((d) => {
      const v = variables.find((x) => x.name === name);
      if (!v) return { ...d, variable: name };
      return { variable: name, operator: operatorsFor(v.type).includes(d.operator) ? d.operator : '==', value: coerceValue(d.value, v.type) };
    });
  return (
    <>
      <Field label={t('cond.variable')}><VariableSelect variables={variables} value={data.variable} onChange={pick} /></Field>
      {variables.length === 0 && <p className="mb-3 text-xs text-pink-deep">{t('cond.noVars')}</p>}
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <Field label={t('cond.operator')}>
          <select className="input" value={data.operator} onChange={(e) => patch((d) => ({ ...d, operator: e.target.value as typeof d.operator }))}>
            {operatorsFor(def?.type ?? 'int').map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label={t('cond.compareTo')}>
          {def ? <ValueInput label={t('cond.compareValue')} type={def.type} value={data.value} onChange={(value) => patch((d) => ({ ...d, value }), 'value')} /> : <input className="input" disabled placeholder={t('cond.pickVar')} />}
        </Field>
      </div>
      <p className="text-xs text-text-sub">{t('cond.flowHint')}</p>
    </>
  );
}

export function VariableForm({ data, patch, variables }: { data: Of<'variable'>; patch: Patch<Of<'variable'>>; variables: VariableDef[] }) {
  const t = useT();
  const def = variables.find((v) => v.name === data.variable);
  const pick = (name: string) =>
    patch((d) => {
      const v = variables.find((x) => x.name === name);
      if (!v) return { ...d, variable: name };
      return { variable: name, operation: operationsFor(v.type).includes(d.operation) ? d.operation : 'set', value: coerceValue(d.value, v.type) };
    });
  return (
    <>
      <Field label={t('cond.variable')}><VariableSelect variables={variables} value={data.variable} onChange={pick} /></Field>
      {variables.length === 0 && <p className="mb-3 text-xs text-pink-deep">{t('cond.noVars')}</p>}
      <Field label={t('var.operation')}>
        <select className="input" value={data.operation} onChange={(e) => patch((d) => ({ ...d, operation: e.target.value as typeof d.operation }))}>
          {operationsFor(def?.type ?? 'int').map((o) => <option key={o} value={o}>{t(`var.op.${o}`)}{def?.type === 'bool' ? ` ${t('var.flag')}` : ''}</option>)}
        </select>
      </Field>
      <Field label={t('var.value')}>
        {def ? <ValueInput label={t('var.value')} type={def.type} value={data.value} onChange={(value) => patch((d) => ({ ...d, value }), 'value')} /> : <input className="input" disabled placeholder={t('cond.pickVar')} />}
      </Field>
    </>
  );
}

export function EventForm({ data, patch }: { data: Of<'event'>; patch: Patch<Of<'event'>> }) {
  const t = useT();
  const spec = findEventSpec(data.eventName);
  const setParam = (id: string, fn: (p: EventParam) => EventParam, key?: string) => patch((d) => ({ ...d, params: d.params.map((p) => (p.id === id ? fn(p) : p)) }), key);
  const required = new Set(spec?.params.filter((p) => p.required).map((p) => p.key));
  return (
    <>
      <Field label={t('event.name')} hint={spec ? t(`event.desc.${spec.name}`) : t('event.customHint')}>
        <input className="input" list="event-names" value={data.eventName} onChange={(e) => {
          const name = e.target.value;
          // Selecting a known event pre-fills its parameters, but never overwrites params the user already typed for the same event.
          patch((d) => (findEventSpec(name) && d.eventName !== name ? { eventName: name, params: paramsForEvent(name) } : { ...d, eventName: name }), 'eventName');
        
        }} placeholder={t('event.namePh')} />
        <datalist id="event-names">{EVENT_CATALOG.map((e) => <option key={e.name} value={e.name}>{t(`event.desc.${e.name}`)}</option>)}</datalist>
      </Field>
      <p className="label">{t('event.params')}</p>
      <ul className="space-y-2">
        {data.params.map((p) => (
          <li key={p.id} className="rounded-xl border border-line bg-bg p-2">
            <div className="grid grid-cols-[1fr_88px] gap-1.5">
              <input className="input !py-1 font-mono text-[13px]" aria-label={t('event.paramKey')} placeholder={t('event.keyPh')} value={p.key} readOnly={required.has(p.key)} onChange={(e) => setParam(p.id, (x) => ({ ...x, key: e.target.value }), `k-${p.id}`)} />
              <TypeSelect label={t('event.paramType')} value={p.valueType} onChange={(t) => setParam(p.id, (x) => ({ ...x, valueType: t, value: coerceValue(x.value, t) }))} />
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              <ValueInput label={t('event.valueOf', { key: p.key || t('event.valueOfParam') })} type={p.valueType} value={p.value} onChange={(value) => setParam(p.id, (x) => ({ ...x, value }), `v-${p.id}`)} />
              {required.has(p.key) ? <span className="flex-none rounded-full bg-pink px-2 py-0.5 text-[10px] font-bold text-pink-deep">{t('event.required')}</span> : <IconButton label={t('event.removeParam')} onClick={() => patch((d) => ({ ...d, params: d.params.filter((x) => x.id !== p.id) }))}><IconTrash size={15} /></IconButton>}
            </div>
          </li>
        ))}
        {data.params.length === 0 && <li className="text-xs italic text-text-sub">{t('event.noParams')}</li>}
      </ul>
      <Button className="mt-2" icon={<IconPlus size={14} />} onClick={() => patch((d) => ({ ...d, params: [...d.params, { id: newId('x'), key: '', valueType: 'string', value: defaultValueFor('string') }] }))}>{t('event.addParam')}</Button>
    </>
  );
}

export function EndForm({ data, patch }: { data: Of<'end'>; patch: Patch<Of<'end'>> }) {
  const t = useT();
  return (
    <Field label={t('end.name')} hint={t('end.hint')}>
      <input className="input" value={data.endingName} onChange={(e) => patch((d) => ({ ...d, endingName: e.target.value }), 'ending')} placeholder={t('end.ph')} />
    </Field>
  );
}

export type { NodeData };
