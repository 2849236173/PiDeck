import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadCodexMetaModule() {
	const source = readFileSync("src/shared/codexSessionMeta.ts", "utf8");
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});
	const sandbox = { exports: {} };
	vm.runInNewContext(outputText, sandbox, { filename: "codexSessionMeta.ts" });
	return sandbox.exports;
}

function loadSessionScanner(homePath) {
	const source = readFileSync("src/main/sessions/SessionScanner.ts", "utf8");
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});
	const codexMeta = loadCodexMetaModule();
	const sandbox = {
		exports: {},
		require: (id) => {
			if (id === "electron") return { app: { getPath: () => homePath } };
			if (id === "../../shared/codexSessionMeta") return codexMeta;
			return require(id);
		},
	};
	vm.runInNewContext(outputText, sandbox, { filename: "SessionScanner.ts" });
	return sandbox.exports;
}

function writeSession(filePath, entries) {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${entries.map(entry => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}

function session(name, cwd) {
	return [
		{ type: "session_info", name, cwd },
		{ type: "message", message: { role: "user", content: "hello" } },
	];
}

test("hides persisted pi-subagents runs without deleting them or unrelated nested sessions", async () => {
	const home = mkdtempSync(join(tmpdir(), "pideck-subagent-scanner-"));
	try {
		const projectPath = "C:\\repo\\project";
		const piDir = join(home, ".pi", "agent", "sessions", "--C--repo-project--");
		const parentFile = join(piDir, "parent.jsonl");
		const workerFile = join(piDir, "parent", "run-abc", "run-0", "session.jsonl");
		const reviewerFile = join(piDir, "parent", "run-abc", "run-1", "session.jsonl");
		const nestedUserFile = join(piDir, "manual", "notes.jsonl");
		const lookalikeFile = join(piDir, "manual", "arbitrary", "run-0", "session.jsonl");

		writeSession(parentFile, session("Parent", projectPath));
		writeSession(join(piDir, "ordinary.jsonl"), session("Ordinary", projectPath));
		writeSession(join(piDir, "subagent-looking-name.jsonl"), session("subagent-worker-manual-0", projectPath));
		// This sibling makes lookalikeFile collide with the legacy ownership layout.
		writeSession(join(piDir, "manual.jsonl"), session("Manual owner", projectPath));
		writeSession(nestedUserFile, session("Nested user session", projectPath));
		writeSession(lookalikeFile, session("Path lookalike", projectPath));
		// Explicit metadata covers new runs even when intercom naming is unavailable.
		writeSession(workerFile, [
			...session("Worker without generated name", projectPath),
			{ type: "custom", customType: "pi-subagents.child-session", data: { schemaVersion: 1 } },
		]);
		// Generated naming plus the standard path retains compatibility with old runs.
		writeSession(reviewerFile, session("subagent-reviewer-run-abc-1", projectPath));

		const { SessionScanner } = loadSessionScanner(home);
		const summaries = await new SessionScanner().list(projectPath);
		const visiblePaths = new Set(summaries.map(summary => summary.filePath));

		assert.equal(visiblePaths.has(parentFile), true);
		assert.equal(visiblePaths.has(nestedUserFile), true);
		assert.equal(visiblePaths.has(lookalikeFile), true);
		// 子会话仍然在摘要列表中，但标记了父会话路径
		assert.equal(visiblePaths.has(workerFile), true);
		assert.equal(visiblePaths.has(reviewerFile), true);
		assert.equal(summaries.some(summary => summary.name === "subagent-worker-manual-0"), true);
		assert.equal(existsSync(workerFile), true);
		assert.equal(existsSync(reviewerFile), true);
		// 验证子会话的 parentSessionPath 指向正确的父会话文件
		const workerSummary = summaries.find(s => s.filePath === workerFile);
		assert.equal(workerSummary.parentSessionPath, parentFile);
		const reviewerSummary = summaries.find(s => s.filePath === reviewerFile);
		assert.equal(reviewerSummary.parentSessionPath, parentFile);
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test("handles orphan, fork, rename and imported-session compatibility without false positives", async () => {
	const home = mkdtempSync(join(tmpdir(), "pideck-orphan-subagent-scanner-"));
	try {
		const projectPath = "/repo/project";
		const piDir = join(home, ".pi", "agent", "sessions", "--repo-project--");
		const orphanFile = join(piDir, "deleted-parent", "orphan-run", "run-0", "session.jsonl");
		const renamedChildFile = join(piDir, "renamed-parent", "manual-run", "run-0", "session.jsonl");
		const legacyForkFile = join(piDir, "legacy-fork.jsonl");
		const manualForkFile = join(piDir, "manual-fork.jsonl");
		const markedCustomFile = join(piDir, "custom-child-location.jsonl");
		const importedFile = join(piDir, "codex-parent", "import-run", "run-0", "session.jsonl");

		writeSession(orphanFile, session("subagent-worker-orphan-run-0", projectPath));
		// PiDeck rename prepends sessionName; the original generated session_info remains authoritative.
		writeSession(renamedChildFile, [
			{ sessionName: "Renamed child", cwd: projectPath },
			...session("subagent-worker-old-run-0", projectPath),
		]);
		writeSession(legacyForkFile, [
			{ type: "session", id: "legacy-child", parentSession: "parent-session.jsonl", cwd: projectPath },
			...session("subagent-worker-fork-run-0", projectPath),
		]);
		writeSession(manualForkFile, [
			{ type: "session", id: "manual-child", parentSession: "parent-session.jsonl", cwd: projectPath },
			{ type: "session_info", name: "subagent-worker-copied-parent-0", cwd: projectPath },
			...session("Manual user fork", projectPath),
		]);
		writeSession(markedCustomFile, [
			...session("Custom-location child", projectPath),
			{ type: "custom", customType: "pi-subagents.child-session", data: { schemaVersion: 1 } },
		]);
		writeSession(join(piDir, "codex-parent.jsonl"), session("Codex owner", projectPath));
		writeSession(importedFile, [
			...session("subagent-reviewer-import-run-0", projectPath),
			{ type: "custom", customType: "pi-subagents.child-session", data: { schemaVersion: 1 } },
			{ type: "codex_import", version: 1, codexSessionId: "codex-child", sourcePath: join(home, "missing.jsonl") },
		]);

		const { SessionScanner } = loadSessionScanner(home);
		const summaries = await new SessionScanner().list(projectPath);
		const visiblePaths = new Set(summaries.map(summary => summary.filePath));

		// 子会话包含在摘要列表中，但标记了 parentSessionPath
		assert.equal(visiblePaths.has(orphanFile), true);
		assert.equal(visiblePaths.has(renamedChildFile), true);
		assert.equal(visiblePaths.has(legacyForkFile), true);
		assert.equal(visiblePaths.has(manualForkFile), true);
		assert.equal(visiblePaths.has(markedCustomFile), true);
		assert.equal(visiblePaths.has(importedFile), true);
		// orphan: 路径可推断父会话（尽管父文件不存在）
		const orphanSummary = summaries.find(s => s.filePath === orphanFile);
		assert.equal(orphanSummary.parentSessionPath, join(piDir, "deleted-parent.jsonl"));
		// renamedChild: 路径可推断父会话
		const renamedSummary = summaries.find(s => s.filePath === renamedChildFile);
		assert.equal(renamedSummary.parentSessionPath, join(piDir, "renamed-parent.jsonl"));
		// legacyFork: 标准 .jsonl 文件路径不可推断父会话，fork parent 文件不存在
		const forkSummary = summaries.find(s => s.filePath === legacyForkFile);
		assert.equal(forkSummary.parentSessionPath, undefined);
		// markedCustomFile: 显式标记，路径不可推断父会话（无 parentSessionPath）
		const customSummary = summaries.find(s => s.filePath === markedCustomFile);
		assert.equal(customSummary.parentSessionPath, undefined);
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
});
