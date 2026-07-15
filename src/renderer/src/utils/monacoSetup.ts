import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Monaco Editor 依赖 Web Worker 做语法高亮。Vite ?worker 后缀会把每个 worker 拆成独立 chunk，
// 避免在 Electron 渲染进程里找不到 worker 入口而降级为无高亮的纯文本模式。
// 语言列表按使用频率添加，减少初始 bundle 体积。
// TypeScript Worker（~13MB）使用动态 import，仅当用户编辑 .ts/.js 文件时才加载，
// 避免首屏强制下载完整的 TS 编译器。
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";

// 缓存 TsWorker 实例，防止多次打开 TS 文件时重复加载
let tsWorkerPromise: Promise<Worker> | null = null;
async function getTsWorker(): Promise<Worker> {
	if (!tsWorkerPromise) {
		tsWorkerPromise = (async () => {
			// 动态 import TypeScript Worker，Vite 会将其拆为独立 chunk，仅在首次访问 TS/JS 语言时下载
			const mod = await import("monaco-editor/esm/vs/language/typescript/ts.worker?worker");
			return new mod.default();
		})();
	}
	return tsWorkerPromise;
}

export function setupMonaco(): void {
	self.MonacoEnvironment = {
		async getWorker(_workerId: string, label: string) {
			switch (label) {
				case "typescript":
				case "javascript":
					return getTsWorker();
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
}
