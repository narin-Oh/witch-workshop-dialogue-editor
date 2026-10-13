import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { validateGraph } from '../../logic/validation';
import { activeGraphOf } from '../../logic/projectOps';
import type { ValidationIssue } from '../../model/types';
import { selectProject, useEditorStore } from '../../store/editorStore';

interface Value {
  issues: ValidationIssue[];
  byNode: Map<string, ValidationIssue[]>;
}
const Ctx = createContext<Value>({ issues: [], byNode: new Map() });

/** Validates the active graph whenever the project changes and shares the result with nodes and panels. */
export function ValidationProvider({ children }: { children: ReactNode }) {
  const project = useEditorStore(selectProject);
  const value = useMemo<Value>(() => {
    const issues = validateGraph(activeGraphOf(project), project.variables);
    const byNode = new Map<string, ValidationIssue[]>();
    for (const i of issues) if (i.nodeId) byNode.set(i.nodeId, [...(byNode.get(i.nodeId) ?? []), i]);
    return { issues, byNode };
  }, [project]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useValidation = (): Value => useContext(Ctx);
