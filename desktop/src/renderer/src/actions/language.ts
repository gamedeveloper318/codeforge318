import { getActiveEditor } from "../monaco/editor-ref";
import { monaco } from "../monaco/setup";
import { setState } from "../state/store";
import { toast } from "./notify";

/** The language's display name, e.g. "python" -> "Python". */
export function languageName(id: string): string {
  const info = monaco.languages.getLanguages().find((l) => l.id === id);
  return info?.aliases?.[0] ?? id;
}

/** Status bar / command palette: change the language of the open file. */
export function pickLanguageMode(): void {
  const model = getActiveEditor()?.getModel();
  if (!model) {
    toast("info", "Change Language Mode needs an open file", "Open a file in the editor first.");
    return;
  }
  const current = model.getLanguageId();
  const languages = monaco.languages
    .getLanguages()
    .filter((l) => l.aliases?.length)
    .sort((a, b) => a.aliases![0].localeCompare(b.aliases![0]));
  setState({
    quickPick: {
      kind: "list",
      placeholder: "Select the language of this file (syntax highlighting and IntelliSense)",
      items: languages.map((l) => ({
        id: l.id,
        label: l.aliases![0],
        description: l.id === current ? `${l.id} — current` : l.id,
      })),
      onPick: (item) => {
        if (!model.isDisposed()) monaco.editor.setModelLanguage(model, item.id);
      },
    },
  });
}
