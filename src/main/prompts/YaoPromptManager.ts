import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { app } from "electron";
import { PromptManager } from "./PromptManager";
import type {
	YaoPromptCategory,
	YaoPromptItem,
	YaoPromptListResult,
	YaoPromptDetailResult,
	PiPromptTemplateSummary,
} from "../../shared/types";

/**
 * 管理 Yao Open Prompts 中文提示词仓库。
 *
 * 提示词文件直接打包在应用 resources/yao-prompts/ 目录下，开箱即用。
 */
export class YaoPromptManager {
	/** 打包在应用内的提示词路径 */
	private readonly bundledDir: string;
	private readonly promptManager: PromptManager;

	constructor(home = homedir()) {
		// 开发时 resources/yao-prompts/ 在项目根目录，打包后在 process.resourcesPath/yao-prompts/
		const base = app.isPackaged
			? process.resourcesPath
			: join(app.getAppPath(), "resources");
		this.bundledDir = join(base, "yao-prompts");
		this.promptManager = new PromptManager(home);
	}

	/**
	 * 获取提示词目录路径
	 */
	private getPromptsDir(): string | null {
		if (existsSync(this.bundledDir)) return this.bundledDir;
		return null;
	}

	/**
	 * 是否可以使用在线更新功能
	 */
	private readonly CATEGORY_NAMES: Record<string, string> = {
		"01-ai-methods": "AI方法",
		"02-ai-work": "AI工作",
		"03-ai-learning": "AI学习",
		"04-ai-life": "AI生活",
		"05-ai-education": "AI教育",
		"06-ai-content": "AI内容",
		"07-ai-coding": "AI编程",
		"08-ai-marketing": "AI营销",
		"09-ai-thinking": "AI思考",
	};

	/**
	 * 列出所有分类和提示词
	 */
	async list(): Promise<YaoPromptListResult> {
		const promptsDir = this.getPromptsDir();
		const categories: YaoPromptCategory[] = [];
		const prompts: YaoPromptItem[] = [];

		if (!promptsDir) {
			return { categories, prompts, repoPath: this.bundledDir };
		}

		const entries = await readdir(promptsDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const categorySlug = entry.name;
			const catDir = join(promptsDir, categorySlug);

			// 优先 hardcode 中文名，其次 README 标题，最后 slug 降级
			let catName = this.CATEGORY_NAMES[categorySlug] ?? "";
			if (!catName) {
				const readmePath = join(catDir, "README.md");
				if (existsSync(readmePath)) {
					const readmeRaw = await readFile(readmePath, "utf8").catch(() => "");
					const titleMatch = readmeRaw.match(/^#\s+(.+)/m);
					if (titleMatch) catName = titleMatch[1].trim();
				}
			}
			if (!catName) {
				// 最终降级：04-ai-life → ai-life → AI Life
				catName = categorySlug.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
			}

			const files = await readdir(catDir);
			const mdFiles = files.filter((f) => f.endsWith(".md") && f !== "README.md");
			categories.push({ slug: categorySlug, name: catName, count: mdFiles.length });

			for (const file of mdFiles) {
				const fullPath = join(catDir, file);
				const raw = await readFile(fullPath, "utf8").catch(() => "");
				if (!raw) continue;

				const frontmatter = this.parseFrontmatter(raw);
				const title = frontmatter.title ?? basename(file, ".md");
				const description = frontmatter.description ?? frontmatter.subcategory ?? "";
				const tags = frontmatter.tags
					? frontmatter.tags.split(/[,，、]/).map((t: string) => t.trim()).filter(Boolean)
					: [];

				prompts.push({
					slug: basename(file, ".md"),
					title,
					category: categorySlug,
					subcategory: frontmatter.subcategory ?? "",
					tags,
					description,
					path: fullPath,
				});
			}
		}

		return { categories, prompts, repoPath: this.bundledDir };
	}

	async detail(slug: string, category: string): Promise<YaoPromptDetailResult | null> {
		const promptsDir = this.getPromptsDir();
		if (!promptsDir) return null;

		const filePath = join(promptsDir, category, `${slug}.md`);
		if (!existsSync(filePath)) return null;

		const raw = await readFile(filePath, "utf8");
		const frontmatter = this.parseFrontmatter(raw);

		let promptContent = "";
		// 定位 ## Prompt 段落，提取其后的所有内容直到文件末尾
		const promptIndex = raw.indexOf("## Prompt");
		if (promptIndex >= 0) {
			// 跳过 ## Prompt 行和开头的代码块标记行（``` / ````markdown）
			let afterPrompt = raw.slice(promptIndex + 9);
			const lines = afterPrompt.split(/\r?\n/);
			// 过滤掉纯代码块标记行（``` 或 ```` 或 ````markdown）
			const cleaned = lines.filter((line) => !/^`{3,}(?:markdown)?$/.test(line.trim()));
			promptContent = cleaned.join("\n").trim();
		} else {
			// 兜底：去掉 frontmatter 后的正文
			const body = raw.replace(/^---[\s\S]*?---\n?/, "").trim();
			promptContent = body;
		}

		return {
			title: frontmatter.title ?? slug,
			description: frontmatter.description ?? "",
			promptContent,
			fullContent: raw,
		};
	}

	async importToPi(slug: string, category: string): Promise<PiPromptTemplateSummary> {
		const detail = await this.detail(slug, category);
		if (!detail) throw new Error(`未找到提示词: ${slug}`);

		const name = slug
			.replace(/[^\p{L}\p{N}-]+/gu, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.toLowerCase();

		const tryCreate = async (tryName: string): Promise<PiPromptTemplateSummary> => {
			try {
				return await this.promptManager.create({
					name: tryName,
					description: detail.description || detail.title,
				});
			} catch {
				const match = tryName.match(/-(\d+)$/);
				const nextNum = match ? parseInt(match[1], 10) + 1 : 2;
				return tryCreate(tryName.replace(/-\d+$/, "") + "-" + nextNum);
			}
		};

		const summary = await tryCreate(name);
		const frontmatter = `---\ndescription: ${(detail.description || detail.title).replace(/\n/g, " ")}\nsource: yao-open-prompts\n---\n\n`;
		await this.promptManager.writeContent(summary.path, frontmatter + detail.promptContent);
		return summary;
	}

	private parseFrontmatter(raw: string): Record<string, string> {
		const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		const result: Record<string, string> = {};
		if (!match) return result;
		for (const line of match[1].split(/\r?\n/)) {
			const idx = line.indexOf(":");
			if (idx === -1) continue;
			const key = line.slice(0, idx).trim();
			let value = line.slice(idx + 1).trim();
			value = value.replace(/^['"]|['"]$/g, "");
			if (key) result[key] = value;
		}
		return result;
	}
}
