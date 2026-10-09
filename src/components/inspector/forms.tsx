import { newChoice, paramsForEvent } from '../../model/factory';
import { newId } from '../../model/ids';
import { EVENT_CATALOG, findEventSpec } from '../../model/eventCatalog';
import { operationsFor, operatorsFor, coerceValue, defaultValueFor } from '../../logic/values';
import type { EditorNode, EventParam, NodeData, VariableDef } from '../../model/types';
import { TypeSelect, ValueInput } from '../common/ValueInput';
import { Button, Field, IconButton } from '../ui/primitives';
import { IconDown, IconPlus, IconTrash, IconUp } from '../ui/Motifs';

type Of<T extends EditorNode['type']> = Extract<EditorNode, { type: T }>['data'];
/** Update callback: patches node data; `key` coalesces rapid edits (typing) into one undo step. */
export type Patch<T> = (fn: (d: T) => T, key?: string) => void;

export function StartForm({ data, patch }: { data: Of<'start'>; patch: Patch<Of<'start'>> }) {
  return (
    <Field label="Note" hint="Editor-only comment. The Start node is not exported; the first node it links to becomes the entry point.">
      <textarea className="input min-h-[72px]" value={data.note} onChange={(e) => patch((d) => ({ ...d, note: e.target.value }), 'note')} />
    </Field>
  );
}

export function DialogueForm({ data, patch }: { data: Of<'dialogue'>; patch: Patch<Of<'dialogue'>> }) {
  const set = <K extends keyof Of<'dialogue'>>(k: K) => (v: Of<'dialogue'>[K]) => patch((d) => ({ ...d, [k]: v }), String(k));
  return (
    <>
      <Field label="Speaker"><input className="input" value={data.speaker} onChange={(e) => set('speaker')(e.target.value)} placeholder="e.g. Lumi" /></Field>
      <Field label="Speaker name override (optional)" hint="If set, this is shown instead of the speaker name."><input className="input" value={data.speakerOverride} onChange={(e) => set('speakerOverride')(e.target.value)} /></Field>
      <Field label="Dialogue text"><textarea className="input min-h-[120px] leading-relaxed" value={data.text} onChange={(e) => set('text')(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Portrait ID"><input className="input" value={data.portraitId} onChange={(e) => set('portraitId')(e.target.value)} /></Field>
        <Field label="Expression"><input className="input" value={data.expression} onChange={(e) => set('expression')(e.target.value)} /></Field>
      </div>
    </>
  );
}

export function ChoiceForm({ data, patch }: { data: Of<'choice'>; patch: Patch<Of<'choice'>> }) {
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
      <p className="label">Choices</p>
      <ol className="space-y-2">
        {data.choices.map((c, i) => (
          <li key={c.id} className="rounded-xl border border-line bg-bg p-2">
            <div className="flex items-start gap-1.5">
              <span className="mt-1.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-yellow text-xs font-bold text-yellow-deep">{i + 1}</span>
              <textarea
                className="input min-h-[52px]"
                aria-label={`Choice ${i + 1} text`}
                value={c.text}
                onChange={(e) => patch((d) => ({ ...d, choices: d.choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) }), `choice-${c.id}`)}
              />
            </div>
            <div className="mt-1 flex justify-end gap-0.5">
              <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><IconUp size={16} /></IconButton>
              <IconButton label="Move down" disabled={i === data.choices.length - 1} onClick={() => move(i, 1)}><IconDown size={16} /></IconButton>
              <IconButton label="Delete choice" onClick={() => patch((d) => ({ ...d, choices: d.choices.filter((x) => x.id !== c.id) }))}><IconTrash size={16} /></IconButton>
            </div>
          </li>
        ))}
      </ol>
      <Button className="mt-2" icon={<IconPlus size={14} />} onClick={() => patch((d) => ({ ...d, choices: [...d.choices, newChoice('')] }))}>Add choice</Button>
      <p className="mt-2 text-xs text-text-sub">Each choice has its own output on the node. Deleting a choice removes its connection.</p>
    </>
  );
}

function VariableSelect({ variables, value, onChange }: { variables: VariableDef[]; value: string; onChange: (name: string) => void }) {
  const known = variables.some((v) => v.name === value);
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— choose —</option>
      {!known && value && <option value={value}>{value} (undefined)</option>}
      {variables.map((v) => (
        <option key={v.id} value={v.name}>{v.name} ({v.scope} {v.type})</option>
      ))}
    </select>
  );
}

export function ConditionForm({ data, patch, variables }: { data: Of<'condition'>; patch: Patch<Of<'condition'>>; variables: VariableDef[] }) {
  const def = variables.find((v) => v.name === data.variable);
  const pick = (name: string) =>
    patch((d) => {
      const v = variables.find((x) => x.name === name);
      if (!v) return { ...d, variable: name };
      return { variable: name, operator: operatorsFor(v.type).includes(d.operator) ? d.operator : '==', value: coerceValue(d.value, v.type) };
    });
  return (
    <>
      <Field label="Variable"><VariableSelect variables={variables} value={data.variable} onChange={pick} /></Field>
      {variables.length === 0 && <p className="mb-3 text-xs text-pink-deep">Define a variable in the left sidebar first.</p>}
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <Field label="Operator">
          <select className="input" value={data.operator} onChange={(e) => patch((d) => ({ ...d, operator: e.target.value as typeof d.operator }))}>
            {operatorsFor(def?.type ?? 'int').map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Compare to">
          {def ? <ValueInput label="Compare value" type={def.type} value={data.value} onChange={(value) => patch((d) => ({ ...d, value }), 'value')} /> : <input className="input" disabled placeholder="choose a variable" />}
        </Field>
      </div>
      <p className="text-xs text-text-sub">Flows to <b className="text-mint-deep">True</b> or <b className="text-pink-deep">False</b>. Both outputs must be connected.</p>
    </>
  );
}

const OPERATION_LABEL = { set: 'Set to', add: 'Increase by', subtract: 'Decrease by' } as const;

export function VariableForm({ data, patch, variables }: { data: Of<'variable'>; patch: Patch<Of<'variable'>>; variables: VariableDef[] }) {
  const def = variables.find((v) => v.name === data.variable);
  const pick = (name: string) =>
    patch((d) => {
      const v = variables.find((x) => x.name === name);
      if (!v) return { ...d, variable: name };
      return { variable: name, operation: operationsFor(v.type).includes(d.operation) ? d.operation : 'set', value: coerceValue(d.value, v.type) };
    });
  return (
    <>
      <Field label="Variable"><VariableSelect variables={variables} value={data.variable} onChange={pick} /></Field>
      {variables.length === 0 && <p className="mb-3 text-xs text-pink-deep">Define a variable in the left sidebar first.</p>}
      <Field label="Operation">
        <select className="input" value={data.operation} onChange={(e) => patch((d) => ({ ...d, operation: e.target.value as typeof d.operation }))}>
          {operationsFor(def?.type ?? 'int').map((o) => <option key={o} value={o}>{OPERATION_LABEL[o]}{def?.type === 'bool' ? ' (flag)' : ''}</option>)}
        </select>
      </Field>
      <Field label="Value">
        {def ? <ValueInput label="Value" type={def.type} value={data.value} onChange={(value) => patch((d) => ({ ...d, value }), 'value')} /> : <input className="input" disabled placeholder="choose a variable" />}
      </Field>
    </>
  );
}

export function EventForm({ data, patch }: { data: Of<'event'>; patch: Patch<Of<'event'>> }) {
  const spec = findEventSpec(data.eventName);
  const setParam = (id: string, fn: (p: EventParam) => EventParam, key?: string) => patch((d) => ({ ...d, params: d.params.map((p) => (p.id === id ? fn(p) : p)) }), key);
  const required = new Set(spec?.params.filter((p) => p.required).map((p) => p.key));
  return (
    <>
      <Field label="Event name" hint={spec ? spec.description : 'Custom event: Unity handlers register by this exact name.'}>
        <input className="input" list="event-names" value={data.eventName} onChange={(e) => {
          const name = e.target.value;
          // Selecting a known event pre-fills its parameters, but never overwrites params the user already typed for the same event.
          patch((d) => (findEventSpec(name) && d.eventName !== name ? { eventName: name, params: paramsForEvent(name) } : { ...d, eventName: name }), 'eventName');
        
        }} placeholder="e.g. OpenShop" />
        <datalist id="event-names">{EVENT_CATALOG.map((e) => <option key={e.name} value={e.name}>{e.description}</option>)}</datalist>
      </Field>
      <p className="label">Parameters</p>
      <ul className="space-y-2">
        {data.params.map((p) => (
          <li key={p.id} className="rounded-xl border border-line bg-bg p-2">
            <div className="grid grid-cols-[1fr_88px] gap-1.5">
              <input className="input !py-1 font-mono text-[13px]" aria-label="Parameter key" placeholder="key" value={p.key} readOnly={required.has(p.key)} onChange={(e) => setParam(p.id, (x) => ({ ...x, key: e.target.value }), `k-${p.id}`)} />
              <TypeSelect label="Parameter type" value={p.valueType} onChange={(t) => setParam(p.id, (x) => ({ ...x, valueType: t, value: coerceValue(x.value, t) }))} />
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              <ValueInput label={`Value of ${p.key || 'parameter'}`} type={p.valueType} value={p.value} onChange={(value) => setParam(p.id, (x) => ({ ...x, value }), `v-${p.id}`)} />
              {required.has(p.key) ? <span className="flex-none rounded-full bg-pink px-2 py-0.5 text-[10px] font-bold text-pink-deep">required</span> : <IconButton label="Remove parameter" onClick={() => patch((d) => ({ ...d, params: d.params.filter((x) => x.id !== p.id) }))}><IconTrash size={15} /></IconButton>}
            </div>
          </li>
        ))}
        {data.params.length === 0 && <li className="text-xs italic text-text-sub">No parameters.</li>}
      </ul>
      <Button className="mt-2" icon={<IconPlus size={14} />} onClick={() => patch((d) => ({ ...d, params: [...d.params, { id: newId('x'), key: '', valueType: 'string', value: defaultValueFor('string') }] }))}>Add parameter</Button>
    </>
  );
}

export function EndForm({ data, patch }: { data: Of<'end'>; patch: Patch<Of<'end'>> }) {
  return (
    <Field label="Ending name" hint="Exported to Unity so game logic can tell endings apart.">
      <input className="input" value={data.endingName} onChange={(e) => patch((d) => ({ ...d, endingName: e.target.value }), 'ending')} placeholder="e.g. Fair Trade" />
    </Field>
  );
}

export type { NodeData };
