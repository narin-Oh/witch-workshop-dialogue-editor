import { GraphList } from './GraphList';
import { NodePalette } from './NodePalette';
import { VariablePanel } from './VariablePanel';

export function Sidebar() {
  return (
    <aside aria-label="Library" className="w-72 flex-none overflow-y-auto border-r border-line bg-bg/60 p-3">
      <NodePalette />
      <GraphList />
      <VariablePanel />
    </aside>
  );
}
