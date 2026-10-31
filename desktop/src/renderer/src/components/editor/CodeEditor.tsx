import { useEffect, useRef } from "react";
import type { Settings } from "@shared/settings";
import { takePendingReveal, takePreserveFocus } from "../../actions/editor";
import { setActiveEditor } from "../../monaco/editor-ref";
import { getEntry } from "../../monaco/models";
import { monaco } from "../../monaco/setup";
import { getState, setState, useStore } from "../../state/store";

export function editorOptions(
  settings: Settings,
): monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions {
  return {
    fontSize: settings["editor.fontSize"],
    fontFamily: settings["editor.fontFamily"],
    fontLigatures: settings["editor.fontLigatures"],
    wordWrap: settings["editor.wordWrap"],
    minimap: { enabled: settings["editor.minimap"] },
    lineNumbers: settings["editor.lineNumbers"],
    renderWhitespace: settings["editor.renderWhitespace"],
    cursorBlinking: settings["editor.cursorBlinking"],
    smoothScrolling: settings["editor.smoothScrolling"],
    cursorSmoothCaretAnimation: settings["editor.smoothScrolling"] ? "on" : "off",
    bracketPairColorization: { enabled: settings["editor.bracketPairColorization"] },
    guides: { bracketPairs: settings["editor.bracketPairColorization"], indentation: true },
    stickyScroll: { enabled: settings["editor.stickyScroll"] },
    scrollBeyondLastLine: false,
    padding: { top: 8, bottom: 8 },
    renderLineHighlight: "all",
    fixedOverflowWidgets: true,
    automaticLayout: true,
    mouseWheelZoom: true,
    tabCompletion: "on",
    linkedEditing: true,
    // Language services color functions, classes, parameters and properties.
    "semanticHighlighting.enabled": true,
    matchBrackets: "always",
    // IntelliSense: suggestions while typing, accepted with Tab or Enter.
    quickSuggestions: { other: "on", comments: "off", strings: "on" },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: "on",
    wordBasedSuggestions: "allDocuments",
    snippetSuggestions: "inline",
    suggest: { showWords: true, showSnippets: true, preview: true, showStatusBar: true },
    parameterHints: { enabled: true, cycle: true },
    hover: { enabled: "on", delay: 400 },
    inlayHints: { enabled: "offUnlessPressed" },
  };
}

// Indentation is detected once per model, falling back to the user's settings.
const indentApplied = new WeakSet<monaco.editor.ITextModel>();

/**
 * The single Monaco editor instance. It stays mounted while other tab kinds
 * (settings, diffs) are shown, so switching back is instant and keeps state.
 */
export function CodeEditor({ tabId }: { tabId: string | null }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const currentTab = useRef<string | null>(null);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    const editor = monaco.editor.create(hostRef.current!, {
      ...editorOptions(getState().settings),
      model: null,
    });
    editorRef.current = editor;
    setActiveEditor(editor);

    const updateStatus = () => {
      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position || !currentTab.current) return;
      const selection = editor.getSelection();
      const options = model.getOptions();
      setState({
        editorStatus: {
          line: position.lineNumber,
          column: position.column,
          selected: selection ? model.getValueLengthInRange(selection) : 0,
          language: model.getLanguageId(),
          eol: model.getEOL() === "\r\n" ? "CRLF" : "LF",
          tabSize: options.tabSize,
          insertSpaces: options.insertSpaces,
          bom: getEntry(currentTab.current)?.bom ?? false,
        },
      });
    };
    const subscriptions = [
      editor.onDidChangeCursorSelection(updateStatus),
      editor.onDidChangeModel(updateStatus),
      editor.onDidChangeModelOptions(updateStatus),
      editor.onDidChangeModelLanguage(updateStatus),
    ];
    return () => {
      subscriptions.forEach((s) => s.dispose());
      setActiveEditor(null);
      editor.dispose();
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const previous = currentTab.current;
    if (previous && previous !== tabId) {
      const previousEntry = getEntry(previous);
      if (previousEntry && !previousEntry.model.isDisposed())
        previousEntry.viewState = editor.saveViewState();
    }
    currentTab.current = tabId;
    if (!tabId) return;
    const entry = getEntry(tabId);
    if (!entry) return;
    if (editor.getModel() !== entry.model) {
      if (!indentApplied.has(entry.model)) {
        const { settings: current } = getState();
        entry.model.detectIndentation(current["editor.insertSpaces"], current["editor.tabSize"]);
        indentApplied.add(entry.model);
      }
      editor.setModel(entry.model);
      if (entry.viewState) editor.restoreViewState(entry.viewState);
    }
    const reveal = takePendingReveal(tabId);
    if (reveal) {
      editor.setSelection({
        startLineNumber: reveal.line,
        startColumn: reveal.column,
        endLineNumber: reveal.endLine ?? reveal.line,
        endColumn: reveal.endColumn ?? reveal.column,
      });
      editor.revealLineInCenter(reveal.line);
    }
    if (!takePreserveFocus(tabId)) editor.focus();
  }, [tabId]);

  useEffect(() => {
    editorRef.current?.updateOptions(editorOptions(settings));
  }, [settings]);

  return (
    <div
      className="monaco-host"
      ref={hostRef}
      data-testid="code-editor"
      style={{ visibility: tabId ? "visible" : "hidden" }}
    />
  );
}
