import { useEffect, useState, type ComponentType } from "react";
import type { Monaco, OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";

type LazyMonacoEditorProps = {
  height?: number | string;
  language?: string;
  onChange?: (value: string | undefined) => void;
  onMount?: OnMount;
  options?: MonacoEditor.IStandaloneEditorConstructionOptions;
  value?: string;
};

type MonacoEditorComponent = ComponentType<LazyMonacoEditorProps>;

export function LazyMonacoEditor(props: LazyMonacoEditorProps) {
  const [EditorComponent, setEditorComponent] = useState<MonacoEditorComponent | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      import("@monaco-editor/react"),
      import("monaco-editor"),
    ]).then(([monacoReact, monaco]) => {
      if (cancelled) {
        return;
      }

      monacoReact.loader.config({ monaco });
      setEditorComponent(() => monacoReact.default);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!EditorComponent) {
    return <div style={{ height: props.height ?? 320 }} />;
  }

  return <EditorComponent {...props} />;
}
