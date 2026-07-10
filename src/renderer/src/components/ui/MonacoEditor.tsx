import { memo } from "react";
import { Editor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Monaco Editor 依赖 Web Worker 做语法高亮。Vite ?worker 后缀会把每个 worker 拆成独立 chunk，
// 避免在 Electron 渲染进程里找不到 worker 入口而降级为无高亮的纯文本模式。
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";

/** 只初始化一次 Monaco loader（CSP 兼容：本地 worker 不走 CDN） */
(function ensureMonaco() {
	self.MonacoEnvironment = {
		getWorker(_workerId: string, label: string) {
			switch (label) {
				case "typescript":
				case "javascript":
					return new TsWorker();
				case "json":
					return new JsonWorker();
				case "css":
				case "scss":
				case "less":
					return new CssWorker();
				case "html":
				case "handlebars":
				case "razor":
					return new HtmlWorker();
				default:
					return new EditorWorker();
			}
		},
	};

	loader.config({ monaco });
})();

export type MonacoEditorProps = {
	value: string;
	onChange?: (value: string) => void;
	language?: string;
	height?: string;
	readOnly?: boolean;
};

/** 统一的 Monaco 编辑器封装，自动处理 loader 初始化和 CSP 兼容。 */
export const MonacoEditor = memo(function MonacoEditor({
	value,
	onChange,
	language = "markdown",
	height = "100%",
	readOnly = false,
}: MonacoEditorProps) {
	const theme =
		document.documentElement.getAttribute("data-theme") === "dark"
			? "vs-dark"
			: "vs";

	return (
		<Editor
			height={height}
			defaultLanguage={language}
			language={language}
			value={value}
			theme={theme}
			onChange={(val) => onChange?.(val ?? "")}
			options={{
				minimap: { enabled: false },
				lineNumbers: "on",
				folding: true,
				fontSize: 13,
				padding: { top: 10, bottom: 10 },
				scrollBeyondLastLine: false,
				wordWrap: "on",
				tabSize: 2,
				insertSpaces: true,
				readOnly,
			}}
		/>
	);
});
