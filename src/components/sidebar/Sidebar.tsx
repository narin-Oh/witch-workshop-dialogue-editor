import { useT } from '../../i18n';
import { GraphList } from './GraphList';
import { NodePalette } from './NodePalette';
import { VariablePanel } from './VariablePanel';

export function Sidebar() {
  const t = useT();
  return (
    <aside aria-label={t('sidebar.aria')} className="w-72 flex-none overflow-y-auto border-r border-line bg-bg/60 p-3">
      <NodePalette />
      <GraphList />
      <VariablePanel />
    </aside>
  );
}
