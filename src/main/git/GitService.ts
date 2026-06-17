import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname } from "node:path";
import type { GitBranchInfo } from "../../shared/types";

const execFileAsync = promisify(execFile);

export class GitService {
	async getBranches(cwd: string): Promise<GitBranchInfo> {
		try {
			// 获取当前分支和所有本地分支（不包含远程分支）
			const [{ stdout: currentRaw }, { stdout: localRaw }] = await Promise.all([
				execFileAsync("git", ["branch", "--show-current"], { cwd }),
				execFileAsync("git", ["branch", "--format=%(refname:short)"], { cwd }),
			]);

			const current = currentRaw.trim() || null;
			const branches = localRaw
				.split(/\r?\n/)
				.map((b) => b.trim())
				.filter(Boolean);

			// 当前分支排在最前
			const sorted = current
				? [current, ...branches.filter((b) => b !== current)]
				: branches;

			return { current, branches: sorted };
		} catch {
			// 非 Git 目录或未安装 git 时只返回空信息，UI 可以降级展示为 no git。
			return { current: null, branches: [] };
		}
	}

	async checkout(cwd: string, branch: string): Promise<GitBranchInfo> {
		// 分支切换会改变工作区状态，先只支持切换已有本地分支，避免隐式创建或修改远端跟踪关系。
		await execFileAsync("git", ["checkout", branch], { cwd });
		return this.getBranches(cwd);
	}

	/**
	 * 基于当前分支创建新分支并切换。
	 * 使用 checkout -b 命令在当前分支基础上创建新分支。
	 */
	async createBranch(cwd: string, branchName: string): Promise<GitBranchInfo> {
		await execFileAsync("git", ["checkout", "-b", branchName], { cwd });
		return this.getBranches(cwd);
	}

	/**
	 * 读取文件在 Git HEAD 中的原始内容，用于差异编辑器左侧基准列。
	 * 边界条件：
	 * - 文件不在任何 Git 仓库内（git 命令失败）→ 返回空字符串，调用方据此降级为“新增文件”对比。
	 * - 文件是未跟踪的新增文件（HEAD 中不存在该路径）→ git show 报错，同样返回空字符串。
	 * 通过文件所在目录定位仓库根，再用相对路径取 HEAD 版本，避免依赖前端传入项目根目录。
	 */
	async getOriginalContent(filePath: string): Promise<string> {
		const cwd = dirname(filePath);
		try {
			// 先确认文件位于 Git 仓库内并取得仓库根，relative 路径用于 git show HEAD:<path>。
			const { stdout: rootRaw } = await execFileAsync(
				"git",
				["rev-parse", "--show-toplevel"],
				{ cwd },
			);
			const repoRoot = rootRaw.trim();
			if (!repoRoot) return "";

			// 用 git 提供的相对路径，规避不同平台分隔符差异；--show-prefix 不可靠时退回 ls-files。
			const { stdout: relRaw } = await execFileAsync(
				"git",
				["ls-files", "--full-name", "--", filePath],
				{ cwd },
			);
			const relPath = relRaw.split(/\r?\n/)[0]?.trim();
			// 文件未被 Git 跟踪（新增文件）时 ls-files 为空，没有 HEAD 版本可对比。
			if (!relPath) return "";

			const { stdout } = await execFileAsync(
				"git",
				["show", `HEAD:${relPath}`],
				{ cwd: repoRoot, maxBuffer: 32 * 1024 * 1024 },
			);
			return stdout;
		} catch {
			// 非 Git 目录、未提交文件或 git 未安装：返回空内容，左侧显示为空表示全部新增。
			return "";
		}
	}
}
