import { useEffect, useRef, useState } from "react";
import { languageForPath } from "@shared/languages";
import { api, errorMessage } from "../../lib/bridge";
import { monaco } from "../../monaco/setup";
import { getState, useStore } from "../../state/store";
import { editorOptions } from "./CodeEditor";

let diffCounter = 0;

/**
 * Read-only Git diff. Unstaged changes compare the index with the working
 * tree; staged changes compare HEAD with the index — the same as `git diff`
 * and `git diff --staged`.
 */
export function DiffView({ path, staged }: { path: string; staged: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const git = useStore((s) => s.git);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    const id = ++diffCounter;
    const language = languageForPath(path);
    const original = monaco.editor.createModel(
      "",
      language,
      monaco.Uri.parse(`codeforge-diff:/${id}/original`),
    );
    const modified = monaco.editor.createModel(
      "",
      language,
      monaco.Uri.parse(`codeforge-diff:/${id}/modified`),
    );
    const editor = monaco.editor.createDiffEditor(hostRef.current!, {
      ...editorOptions(getState().settings),
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
    });
    editor.setModel({ original, modified });
    editorRef.current = editor;
    return () => {
      editor.dispose();
      original.dispose();
      modified.dispose();
    };
  }, [path]);

  // Reload whenever Git status changes (stage, commit, edits on disk...).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const before = (await api.invoke("git:show", path, staged ? "HEAD" : "INDEX")) ?? "";
        const after = staged
          ? ((await api.invoke("git:show", path, "INDEX")) ?? "")
          : await api.invoke("fs:read-file", path).then(
              (file) => (file.binary ? "(binary file)" : file.content),
              () => "",
            );
        const model = editorRef.current?.getModel();
        if (cancelled || !model) return;
        if (model.original.getValue() !== before) model.original.setValue(before);
        if (model.modified.getValue() !== after) model.modified.setValue(after);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, staged, git]);

  useEffect(() => {
    editorRef.current?.updateOptions(editorOptions(settings));
  }, [settings]);

  return (
    <>
      <div className="monaco-host" ref={hostRef} data-testid="diff-editor" />
      {error && <div className="editor-message">Could not load the diff: {error}</div>}
    </>
  );
}
