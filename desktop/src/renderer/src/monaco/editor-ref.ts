import { toast } from "../actions/notify";
import type { monaco } from "./setup";

/** The single code editor instance, shared by commands and actions. */
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

export function setActiveEditor(instance: monaco.editor.IStandaloneCodeEditor | null): void {
  editor = instance;
}

export function getActiveEditor(): monaco.editor.IStandaloneCodeEditor | null {
  return editor;
}

/** The editor, if a file is open in it; otherwise explains why `what` can't run. */
export function editorWithFile(what: string): monaco.editor.IStandaloneCodeEditor | null {
  if (editor?.getModel()) return editor;
  toast("info", `${what} needs an open file`, "Open or create a file in the editor first.");
  return null;
}

/** Runs a built-in Monaco action (undo, find, format, fold, ...) on the open file. */
export function runEditorAction(actionId: string, title = "This command"): void {
  const target = editorWithFile(title);
  if (!target) return;
  target.focus();
  const action = target.getAction(actionId);
  if (action) {
    if (!action.isSupported()) {
      toast("info", `${title} isn't available for this file.`);
      return;
    }
    void action.run();
  } else {
    target.trigger("codeforge", actionId, null);
  }
}
