import { memo, useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import { setupMonaco } from "../../utils/monacoSetup";

/** Monaco 初始化保证只执行一次 */
let monacoInitialized = false;
function ensureMonacoOnce(): void {
	if (monacoInitialized) return;
	monacoInitialized = true;
	setupMonaco();
}

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
	// 首次渲染时确保 Monaco 已初始化（worker 配置 + loader），
	// 必须放在组件内，因为 Monaco 需要在浏览器 DOM 环境中初始化，
	// 不能放在模块作用域（Node.js 环境下 import 时会报 self 未定义）。
	// 使用 ensureMonacoOnce 保证只执行一次，避免后续渲染重复设置。
	useEffect(() => {
		ensureMonacoOnce();
	}, []);

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
