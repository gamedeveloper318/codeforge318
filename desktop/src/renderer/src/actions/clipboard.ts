import { editorWithFile } from "../monaco/editor-ref";
import { reportError, toast } from "./notify";

/**
 * Edit > Paste. Ctrl+V is handled by the editor itself; the menu item reads
 * the clipboard explicitly because browsers don't let a page trigger a paste.
 * Multiple cursors get one line each, like Ctrl+V.
 */
export async function pasteIntoEditor(): Promise<void> {
  const editor = editorWithFile("Paste");
  if (!editor) return;
  let text: string;
  try {
    text = await navigator.clipboard.readText();
  } catch (error) {
    reportError("Could not read the clipboard", error);
    return;
  }
  if (!text) {
    toast("info", "The clipboard has no text to paste.");
    return;
  }
  editor.focus();
  editor.trigger("menu", "paste", { text });
}
