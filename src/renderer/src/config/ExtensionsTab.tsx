import { useState } from "react";
import type { PiExtensionListResult, PiExtensionSummary, PiPackageInfo } from "../../../shared/types";
import { t } from "../i18n";

type ExtensionsApi = {
	list: () => Promise<PiExtensionListResult>;
	uninstall: (source: string, scope?: "user" | "project" | "unknown") => Promise<void>;
	install: (source: string) => Promise<string>;
};

const api: ExtensionsApi = (window as unknown as { piDesktop?: { extensions: ExtensionsApi } }).piDesktop!.extensions;

/** 预设推荐扩展包 */
const RECOMMENDED_PACKAGES: PiPackageInfo[] = [
	{
		name: "context-mode",
		description: "MCP 插件，可节省 98% 的上下文窗口。支持 Claude Code、Gemini CLI、VS Code Copilot 等。沙箱代码执行、FTS5 知识库和意图驱动搜索。",
		installCmd: "npm:context-mode",
		tags: ["extension"],
		downloads: "107K/mo",
		updated: "",
		npmUrl: "https://www.npmjs.com/package/context-mode",
		repoUrl: "https://github.com/mksglu/context-mode",
	},
	{
		name: "pi-web-access",
		description: "网络搜索、URL 抓取、GitHub 仓库克隆、PDF 提取、YouTube 视频理解和本地视频分析。",
		installCmd: "npm:pi-web-access",
		tags: ["extension"],
		downloads: "99K/mo",
		updated: "",
		npmUrl: "https://www.npmjs.com/package/pi-web-access",
		repoUrl: "https://github.com/nicobailon/pi-web-access",
	},
	{
		name: "pi-mcp-adapter",
		description: "MCP（Model Context Protocol）适配器扩展，让 Pi 可以连接任何 MCP 服务器。",
		installCmd: "npm:pi-mcp-adapter",
		tags: ["extension"],
		downloads: "99K/mo",
		updated: "",
		npmUrl: "https://www.npmjs.com/package/pi-mcp-adapter",
		repoUrl: "https://github.com/nicobailon/pi-mcp-adapter",
	},
	{
		name: "pi-subagents",
		description: "任务委派扩展，支持链式、并行执行和 TUI 澄清。可将复杂任务拆解给多个子 Agent。",
		installCmd: "npm:pi-subagents",
		tags: ["extension"],
		downloads: "92K/mo",
		updated: "",
		npmUrl: "https://www.npmjs.com/package/pi-subagents",
		repoUrl: "https://github.com/nicobailon/pi-subagents",
	},
];

export function ExtensionsTab(props: {
	data: PiExtensionListResult;
	loading: boolean;
	uninstallingSource: string | null;
	onRefresh: () => void;
	onUninstall: (extension: PiExtensionSummary) => void;
}) {
	const [installing, setInstalling] = useState<string | null>(null);

	const handleInstall = async (pkg: PiPackageInfo) => {
		setInstalling(pkg.name);
		try {
			await api.install(pkg.installCmd);
			props.onRefresh();
		} catch (e) {
			alert(t("config.installFailed") + ": " + (e instanceof Error ? e.message : String(e)));
		} finally {
			setInstalling(null);
		}
	};

	return (
		<div className="extensions-tab">
			{/* 预设推荐扩展 */}
			<div className="config-section" style={{ marginBottom: 20 }}>
				<div className="config-toolbar">
					<span className="config-count">{t("config.recommendedPackages")}</span>
				</div>
				<p className="config-im-form-hint" style={{ marginBottom: 12 }}>
					{t("config.recommendedPackagesHint")}
				</p>
				{RECOMMENDED_PACKAGES.map((pkg) => (
					<div key={pkg.name} className="config-card" style={{ marginBottom: 8 }}>
						<div className="config-card-header">
							<div className="config-card-info">
								<div className="config-card-name">
									<code>{pkg.name}</code>
									{pkg.tags.length > 0 && (
										<span style={{ marginLeft: 8 }}>
											{pkg.tags.map((tag) => (
												<span key={tag} className="skill-state enabled" style={{ marginRight: 4, fontSize: "var(--font-size-micro)" }}>{tag}</span>
											))}
										</span>
									)}
								</div>
								<div className="config-card-meta">
									{pkg.description}
								</div>
								<div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: "var(--font-size-micro)", color: "var(--color-text-tertiary)" }}>
									{pkg.downloads && <span>📥 {pkg.downloads}</span>}
									{pkg.npmUrl && <a href={pkg.npmUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)" }}>npm</a>}
									{pkg.repoUrl && <a href={pkg.repoUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)" }}>repo</a>}
								</div>
							</div>
							<div className="config-card-actions">
								{installing === pkg.name ? (
									<span className="config-btn" style={{ opacity: 0.6 }}>{t("config.installing")}</span>
								) : (
									<button
										className="config-btn primary"
										onClick={() => handleInstall(pkg)}
									>
										{t("config.install")}
									</button>
								)}
							</div>
						</div>
					</div>
				))}
			</div>

			{/* 已安装扩展列表 */}
			<div className="config-section">
				<div className="config-toolbar">
					<div>
						<span className="config-count">
							{t("config.count.extensions", { count: props.data.extensions.length })}
						</span>
						<small className="skills-restart-hint">
							{t("config.extensionRestartHint")}
						</small>
					</div>
					<div className="skills-toolbar-actions">
						<button className="config-btn" onClick={props.onRefresh} disabled={props.loading}>
							{t("common.refresh")}
						</button>
					</div>
				</div>
				<div className="skills-list">
					{props.data.extensions.length === 0 ? (
						<div className="config-empty">{t("config.emptyExtensions")}</div>
					) : (
						props.data.extensions.map((extension) => (
							<ExtensionCard
								key={extension.id}
								extension={extension}
								uninstalling={props.uninstallingSource === extension.source}
								onUninstall={props.onUninstall}
							/>
						))
					)}
				</div>
			</div>
		</div>
	);
}

function ExtensionCard(props: {
	extension: PiExtensionSummary;
	uninstalling: boolean;
	onUninstall: (extension: PiExtensionSummary) => void;
}) {
	const { extension } = props;
	const name = extension.source.replace(/^(?:npm|file|github|git):/i, "");
	return (
		<article className="session-card skill-card extension-card">
			<div className="session-card-display">
				<div className="session-card-inner skill-card-main">
					<div className="session-card-title skill-title-row">
						<strong>{name}</strong>
						<div className="skill-badges">
							<span className="skill-state enabled">
								{extension.scope === "project"
									? t("common.project")
									: t("common.global")}
							</span>
						</div>
					</div>
					<small>{extension.source}</small>
					{extension.path && <small>{extension.path}</small>}
				</div>
				<div className="session-card-actions skill-card-actions">
					<button
						className="session-rename-button danger"
						disabled={props.uninstalling}
						onClick={() => props.onUninstall(extension)}
					>
						{props.uninstalling ? t("config.uninstalling") : t("config.uninstall")}
					</button>
				</div>
			</div>
		</article>
	);
}
