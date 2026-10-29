import type { monaco } from "./setup";

/** The single code editor instance, shared by commands and actions. */
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

export function setActiveEditor(instance: monaco.editor.IStandaloneCodeEditor | null): void {
  editor = instance;
}

export function getActiveEditor(): monaco.editor.IStandaloneCodeEditor | null {
  return editor;
}

/** Runs a built-in Monaco action (format, comment, fold, ...) on the editor. */
export function runEditorAction(actionId: string): void {
  if (!editor) return;
  editor.focus();
  const action = editor.getAction(actionId);
  if (action) void action.run();
  else editor.trigger("codeforge", actionId, null);
}
