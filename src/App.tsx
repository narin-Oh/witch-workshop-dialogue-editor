import { ReactFlowProvider } from '@xyflow/react';
import { GraphCanvas } from './components/canvas/GraphCanvas';
import { Notices } from './components/common/Toast';
import { Inspector } from './components/inspector/Inspector';
import { PreviewModal } from './components/preview/PreviewModal';
import { Sidebar } from './components/sidebar/Sidebar';
import { Toolbar, saveProjectFile } from './components/toolbar/Toolbar';
import { BottomPanel } from './components/validation/BottomPanel';
import { ValidationProvider } from './components/validation/ValidationContext';
import { useAutosave } from './hooks/useAutosave';
import { useShortcuts } from './hooks/useShortcuts';
import { useT } from './i18n';

export default function App() {
  const t = useT();
  useAutosave();
  useShortcuts(saveProjectFile);
  return (
    <ReactFlowProvider>
      <ValidationProvider>
        <div className="flex h-full flex-col">
          <Toolbar />
          <Notices />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="min-w-0 flex-1 bg-bg" aria-label={t('canvas.editorAria')}>
              <GraphCanvas />
            </main>
            <Inspector />
          </div>
          <BottomPanel />
        </div>
        <PreviewModal />
      </ValidationProvider>
    </ReactFlowProvider>
  );
}
