import { activeGraphOf } from '../../logic/projectOps';
import { selectProject, useEditorStore } from '../../store/editorStore';
import type { EditorNode, NodeData } from '../../model/types';
import { NODE_META } from '../canvas/nodeMeta';
import { useValidation } from '../validation/ValidationContext';
import { Button } from '../ui/primitives';
import { IconCopy, IconError, IconTrash, IconWarn, Moon, StarDivider } from '../ui/Motifs';
import { ChoiceForm, ConditionForm, DialogueForm, EndForm, EventForm, StartForm, VariableForm, type Patch } from './forms';

function NodeForm({ node }: { node: EditorNode }) {
  const variables = useEditorStore((s) => selectProject(s).variables);
  const update = useEditorStore.getState().updateNodeData;
  const mk = <T,>(): Patch<T> => (fn, key) => update(node.id, fn as unknown as (d: NodeData) => NodeData, key);
  switch (node.type) {
    case 'start': return <StartForm data={node.data} patch={mk()} />;
    case 'dialogue': return <DialogueForm data={node.data} patch={mk()} />;
    case 'choice': return <ChoiceForm data={node.data} patch={mk()} />;
    case 'condition': return <ConditionForm data={node.data} patch={mk()} variables={variables} />;
    case 'variable': return <VariableForm data={node.data} patch={mk()} variables={variables} />;
    case 'event': return <EventForm data={node.data} patch={mk()} />;
    case 'end': return <EndForm data={node.data} patch={mk()} />;
  }
}

export function Inspector() {
  const graph = useEditorStore((s) => activeGraphOf(selectProject(s)));
  const { duplicate, deleteSelection } = useEditorStore.getState();
  const { byNode } = useValidation();
  const selected = graph.nodes.filter((n) => n.selected);
  const node = selected.length === 1 ? selected[0] : undefined;

  return (
    <aside aria-label="Inspector" className="w-80 flex-none overflow-y-auto border-l border-line bg-bg/60 p-3">
      {!node ? (
        <div className="mt-10 px-3 text-center text-text-sub">
          <Moon size={28} className="mx-auto mb-2 text-primary-deep" />
          <h2 className="font-serif text-base font-bold text-text">{selected.length > 1 ? `${selected.length} notes selected` : 'Nothing selected'}</h2>
          <p className="mt-1 text-xs">{selected.length > 1 ? 'Copy, duplicate or delete them together.' : 'Select a note on the canvas to edit its details.'}</p>
          {selected.length > 1 && (
            <div className="mt-3 flex justify-center gap-2">
              <Button icon={<IconCopy size={14} />} onClick={duplicate}>Duplicate</Button>
              <Button variant="danger" icon={<IconTrash size={14} />} onClick={deleteSelection}>Delete</Button>
            </div>
          )}
        </div>
      ) : (
        <div key={node.id} className="rounded-2xl border border-line bg-panel p-3 shadow-card">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${NODE_META[node.type].chip}`}>{NODE_META[node.type].icon}</span>
            <div>
              <h2 className="font-serif text-base font-bold leading-tight">{NODE_META[node.type].label}</h2>
              <p className="text-xs text-text-sub">{NODE_META[node.type].description}</p>
            </div>
          </div>
          <StarDivider />
          {(byNode.get(node.id) ?? []).length > 0 && (
            <ul className="mb-3 space-y-1">
              {byNode.get(node.id)!.map((i) => (
                <li key={i.id} className={`flex items-start gap-1.5 rounded-lg px-2 py-1 text-xs ${i.severity === 'error' ? 'bg-pink-soft text-pink-deep' : 'bg-yellow-soft text-yellow-deep'}`}>
                  {i.severity === 'error' ? <IconError size={14} className="mt-0.5 flex-none" /> : <IconWarn size={14} className="mt-0.5 flex-none" />}
                  {i.message}
                </li>
              ))}
            </ul>
          )}
          <NodeForm node={node} />
          <StarDivider />
          <div className="flex gap-2">
            <Button icon={<IconCopy size={14} />} onClick={duplicate} disabled={node.type === 'start'} title={node.type === 'start' ? 'A graph has exactly one Start node' : 'Duplicate (Ctrl+D)'}>Duplicate</Button>
            <Button variant="danger" icon={<IconTrash size={14} />} onClick={deleteSelection}>Delete</Button>
          </div>
          <p className="mt-2 break-all text-[10px] text-text-sub/80">id: {node.id}</p>
        </div>
      )}
    </aside>
  );
}
