import { canRedo, canUndo } from '../../logic/history';
import { activeGraphOf } from '../../logic/projectOps';
import { errorsOf, validateGraph } from '../../logic/validation';
import { downloadText, pickTextFile, slugify } from '../../io/files';
import { parseProject, ProjectFileError, serializeProject } from '../../io/projectFile';
import { ExportError, exportRuntime, runtimeToJson } from '../../io/runtimeExport';
import { selectProject, useEditorStore } from '../../store/editorStore';
import { Button, IconButton } from '../ui/primitives';
import { IconExport, IconOpen, IconPlay, IconRedo, IconSave, IconUndo, Logo, Sparkle } from '../ui/Motifs';

export function saveProjectFile(): void {
  const st = useEditorStore.getState();
  const p = st.history.present;
  downloadText(`${slugify(p.name, 'witch-workshop')}.witchproj.json`, serializeProject(p));
  st.notify({ kind: 'success', text: 'Project saved to a file.' });
}

async function openProjectFile(): Promise<void> {
  const st = useEditorStore.getState();
  const f = await pickTextFile();
  if (!f) return;
  try {
    st.loadProject(parseProject(f.text));
    st.notify({ kind: 'success', text: `Opened ${f.name}.` });
  } catch (e) {
    st.notify({ kind: 'error', text: e instanceof ProjectFileError ? `Could not open file: ${e.message}` : 'Could not open file.' });
  }
}

/** Export the active graph for Unity. Blocked while the graph has validation errors. */
export function exportUnity(): void {
  const st = useEditorStore.getState();
  const p = st.history.present;
  const g = activeGraphOf(p);
  const issues = validateGraph(g, p.variables);
  const errors = errorsOf(issues);
  if (errors.length) {
    st.setBottom(true, 'validation');
    st.notify({ kind: 'error', text: `Export blocked: fix ${errors.length} error${errors.length > 1 ? 's' : ''} first (see the Validation panel).` });
    return;
  }
  const warnings = issues.length;
  if (warnings && !window.confirm(`The graph has ${warnings} warning${warnings > 1 ? 's' : ''}. Export anyway?`)) return;
  try {
    downloadText(`${slugify(g.name, 'dialogue')}.dialogue.json`, runtimeToJson(exportRuntime(g, p.variables)));
    st.notify({ kind: 'success', text: `Exported "${g.name}" for Unity.` });
  } catch (e) {
    st.notify({ kind: 'error', text: e instanceof ExportError ? e.message : 'Export failed.' });
  }
}

export function Toolbar() {
  const name = useEditorStore((s) => selectProject(s).name);
  const undoable = useEditorStore((s) => canUndo(s.history));
  const redoable = useEditorStore((s) => canRedo(s.history));
  const { renameProject, undo, redo, newProject, loadSamples, setPreviewOpen } = useEditorStore.getState();
  return (
    <header className="flex flex-none items-center gap-3 border-b border-line bg-panel px-4 py-2 shadow-card">
      <div className="flex items-center gap-2">
        <Logo />
        <div className="leading-tight">
          <div className="font-serif text-[15px] font-bold">Witch Workshop</div>
          <div className="text-[11px] text-text-sub">Story Notebook</div>
        </div>
      </div>
      <input
        className="ml-3 w-56 rounded-t-xl border-b-2 border-primary/60 bg-primary-soft/60 px-3 py-1 font-serif text-[14px] font-semibold focus:border-primary-deep focus:bg-primary-soft"
        aria-label="Project name"
        value={name}
        onChange={(e) => renameProject(e.target.value)}
      />
      <div className="ml-auto flex items-center gap-1.5">
        <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!undoable}><IconUndo size={18} /></IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!redoable}><IconRedo size={18} /></IconButton>
        <span className="mx-1 h-6 w-px bg-line" />
        <Button variant="ghost" icon={<Sparkle size={16} />} onClick={() => window.confirm('Replace the current project with a new empty one? Unsaved work will be lost (you can still undo).') && newProject()}>New</Button>
        <Button variant="ghost" icon={<IconOpen size={16} />} onClick={() => void openProjectFile()}>Open</Button>
        <Button variant="ghost" onClick={() => window.confirm('Load the sample project? It replaces the current project.') && loadSamples()}>Samples</Button>
        <Button icon={<IconSave size={16} />} onClick={saveProjectFile}>Save</Button>
        <Button icon={<IconExport size={16} />} onClick={exportUnity}>Export Unity JSON</Button>
        <Button variant="primary" icon={<IconPlay size={16} />} onClick={() => setPreviewOpen(true)}>Preview</Button>
      </div>
    </header>
  );
}
