import { lazy, Suspense, memo } from "react";
import type { MonacoEditorProps } from "./MonacoEditor";

// 动态加载 MonacoEditor（7.8MB vendor-monaco + 4.3MB workers）。
// 仅当用户打开编辑器面板（配置弹窗、项目资源编辑器）时才会下载对应 chunk。
const MonacoEditorLazy = lazy(
  () =>
    import("./MonacoEditor").then((m) => ({
      default: m.MonacoEditor,
    })),
);

/**
 * MonacoEditor 的懒加载包装。在没有编辑需求的页面中完全跳过 7.8MB 的 Monaco 加载。
 * 配合 React.lazy + Suspense，monaco-editor chunk 首次被渲染时才开始下载。
 */
export const LazyMonacoEditor = memo(function LazyMonacoEditor(
  props: MonacoEditorProps,
) {
  return (
    <Suspense
      fallback={
        <div
          className="editor-loading"
          style={{
            height: props.height || "100%",
            minHeight: 60,
            background: "var(--color-bg-secondary)",
            borderRadius: "var(--radius-sm)",
          }}
        />
      }
    >
      <MonacoEditorLazy {...props} />
    </Suspense>
  );
});
