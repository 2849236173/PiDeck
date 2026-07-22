// @ts-nocheck - SkillHub store panel, new feature
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Download, Star, ArrowLeft, ExternalLink, Sparkles, Check, AlertCircle } from "lucide-react";
import { t } from "../i18n";
import { showNotice } from "../utils/notice";
import type { SkillHubItem, SkillHubDetail, SkillHubSearchResult, SkillHubInstallResult } from "../../../shared/types";

const api = (window as unknown as {
	piDesktop: {
		skillHub: {
			search: (q: string, page?: number) => Promise<SkillHubSearchResult>;
			detail: (slug: string) => Promise<SkillHubDetail | null>;
			install: (slug: string, installDir: string) => Promise<SkillHubInstallResult>;
		};
	};
}).piDesktop;

const SUGGESTED_SEARCHES = [
	"pdf", "ocr", "translate", "code review", "react",
	"python", "git", "image", "data", "writing",
];

function fmtNum(n: number): string {
	if (n >= 10000) return (n / 10000).toFixed(1) + "w";
	if (n >= 1000) return (n / 1000).toFixed(1) + "k";
	return String(n);
}

export function SkillHubStorePanel() {
	const [query, setQuery] = useState("");
	const [searching, setSearching] = useState(false);
	const [result, setResult] = useState<SkillHubSearchResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [previewSlug, setPreviewSlug] = useState<string | null>(null);
	const [detail, setDetail] = useState<SkillHubDetail | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [installing, setInstalling] = useState(false);
	const [installResult, setInstallResult] = useState<SkillHubInstallResult | null>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		searchInputRef.current?.focus();
	}, []);

	const handleSearch = useCallback(async (searchQuery: string) => {
		const q = searchQuery.trim();
		if (!q) return;
		setResult(null);
		setPreviewSlug(null);
		setDetail(null);
		setInstallResult(null);
		setError(null);
		setSearching(true);
		try {
			const data = await api.skillHub.search(q);
			setResult(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSearching(false);
		}
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") void handleSearch(query);
	};

	const openDetail = useCallback(async (slug: string) => {
		setPreviewSlug(slug);
		setDetail(null);
		setInstallResult(null);
		setDetailLoading(true);
		try {
			const data = await api.skillHub.detail(slug);
			setDetail(data);
		} catch {
			setDetail(null);
		} finally {
			setDetailLoading(false);
		}
	}, []);

	const handleInstall = async () => {
		if (!previewSlug) return;
		setInstalling(true);
		setInstallResult(null);
		try {
			const result = await api.skillHub.install(previewSlug, "");
			setInstallResult(result);
			if (result.success) {
				showNotice(t("app.skillsInstalled", { name: detail?.skill?.displayName || previewSlug }), 3000);
			}
		} catch (err) {
			setInstallResult({ success: false, slug: previewSlug, installDir: "", error: String(err) });
		} finally {
			setInstalling(false);
		}
	};

	// Detail view
	if (previewSlug) {
		return (
			<div className="skillhub-panel">
				<div className="skillhub-detail-toolbar">
					<button className="config-btn" onClick={() => { setPreviewSlug(null); setDetail(null); setInstallResult(null); }}>
						<ArrowLeft size={14} />
						{t("config.promptStoreBack")}
					</button>
					<button
						className="config-btn primary"
						onClick={handleInstall}
						disabled={installing || !detail}
					>
						{installing ? t("common.installing") + "…" : <><Download size={14} /> {t("common.install")}</>}
					</button>
				</div>

				{installResult && (
					<div className={`skillhub-install-result ${installResult.success ? "success" : "error"}`}>
						{installResult.success ? (
							<><Check size={16} /> {t("app.skillsInstalled", { name: detail?.skill?.displayName || previewSlug })}</>
						) : (
							<><AlertCircle size={16} /> {installResult.error || t("common.error")}</>
						)}
					</div>
				)}

				{detailLoading && (
					<div className="config-loading">{t("common.loading")}…</div>
				)}

				{detail && !detailLoading && (
					<div className="skillhub-detail">
						<div className="skillhub-detail-header">
							{detail.skill.iconUrl ? (
								<img
									className="skillhub-detail-icon"
									src={detail.skill.iconUrl}
									alt=""
									onError={(e) => {
										(e.target as HTMLImageElement).style.display = "none";
										const fallback = (e.target as HTMLImageElement).nextElementSibling;
										if (fallback) (fallback as HTMLElement).style.display = "flex";
									}}
								/>
							) : null}
							<div className="skillhub-detail-icon skillhub-detail-icon--fallback"
								style={{ display: detail.skill.iconUrl ? "none" : "flex" }}>
								<Sparkles size={20} />
							</div>
							<div>
								<h2>{detail.skill.displayName}</h2>
								<div className="skillhub-detail-meta">
									<span className="skillhub-detail-owner">{detail.owner.displayName}</span>
									{detail.skill.verified && <span className="skillhub-detail-badge">{t("common.verified")}</span>}
								</div>
							</div>
						</div>

						<div className="skillhub-detail-stats">
							<div className="skillhub-detail-stat">
								<Star size={14} fill="currentColor" />
								<span>{fmtNum(detail.skill.stats.stars)}</span>
							</div>
							<div className="skillhub-detail-stat">
								<Download size={14} />
								<span>{fmtNum(detail.skill.stats.downloads)}</span>
							</div>
							<div className="skillhub-detail-stat">
								<span>{detail.skill.stats.versions} {t("common.versions")}</span>
							</div>
						</div>

						{detail.skill.category && (
							<div className="skillhub-detail-tags">
								<span className="skillhub-tag">{detail.skill.category}</span>
								{detail.skill.subCategories?.map((sc) => (
									<span key={sc.key} className="skillhub-tag skillhub-tag--sub">{sc.name}</span>
								))}
							</div>
						)}

						<div className="skillhub-detail-section">
							<h4>{t("common.description")}</h4>
							<p>{detail.skill.summary_zh || detail.skill.summary}</p>
						</div>

						<div className="skillhub-detail-section">
							<h4>{t("common.version")}</h4>
							<p className="skillhub-detail-version">
								<code>{detail.latestVersion.version}</code>
								{detail.latestVersion.changelog && (
									<span className="skillhub-detail-changelog">{detail.latestVersion.changelog}</span>
								)}
							</p>
						</div>
					</div>
				)}

				{!detail && !detailLoading && (
					<div className="config-loading">{t("common.loading")}…</div>
				)}
			</div>
		);
	}

	// Search / List view
	return (
		<div className="skillhub-panel">
			<div className="skillhub-search-bar">
				<div className="skillhub-search-input-wrap">
					<Search size={15} strokeWidth={1.8} className="skillhub-search-icon" />
					<input
						ref={searchInputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={t("config.skillHubSearchPlaceholder")}
						disabled={searching}
					/>
					<button
						className="config-btn primary"
						onClick={() => void handleSearch(query)}
						disabled={searching || !query.trim()}
					>
						{searching ? t("common.searching") + "…" : <Search size={14} />}
					</button>
				</div>
				{!result && !searching && (
					<div className="skillhub-suggestions">
						{SUGGESTED_SEARCHES.map((s) => (
							<button
								key={s}
								className="skillhub-suggestion-chip"
								onClick={() => { setQuery(s); void handleSearch(s); }}
							>
								{s}
							</button>
						))}
					</div>
				)}
			</div>

			{error && <div className="config-error">{error}</div>}
			{searching && <div className="config-loading">{t("common.searching")}…</div>}

			{result && !searching && result.total === 0 && (
				<div className="config-empty">{t("config.noSearchResults")}</div>
			)}

			{result && result.total > 0 && (
				<div className="skillhub-results">
					<small className="skillhub-result-count">
						{result.total} {t("common.results")}
					</small>
					{result.items.map((item) => (
						<article
							key={item.slug}
							className="skillhub-card"
							onClick={() => void openDetail(item.slug)}
						>
							<div className="skillhub-card-icon-wrap">
								<img
									className="skillhub-card-icon"
									src={item.iconUrl}
									alt=""
									onError={(e) => {
										(e.target as HTMLImageElement).style.display = "none";
										const fb = (e.target as HTMLImageElement).parentElement?.querySelector(".skillhub-card-icon--fallback");
										if (fb) (fb as HTMLElement).style.display = "flex";
									}}
								/>
								<div className="skillhub-card-icon skillhub-card-icon--fallback"
									style={{ display: "none" }}>
									<Sparkles size={16} />
								</div>
							</div>
							<div className="skillhub-card-main">
								<strong className="skillhub-card-title">{item.name}</strong>
								<p className="skillhub-card-desc">
									{(item.description_zh || item.description || "").substring(0, 120)}
									{(item.description_zh || item.description || "").length > 120 ? "…" : ""}
								</p>
								<div className="skillhub-card-meta">
									{item.category && <span className="skillhub-card-category">{item.category}</span>}
									<span className="skillhub-card-stats">
										<Star size={11} fill="currentColor" /> {fmtNum(item.stars)}
									</span>
									<span className="skillhub-card-stats">
										<Download size={11} /> {fmtNum(item.downloads)}
									</span>
								</div>
							</div>
							<button
								className="skillhub-card-install-btn"
								title={t("common.install")}
								onClick={async (e) => {
									e.stopPropagation();
									await openDetail(item.slug);
								}}
							>
								<Download size={14} />
							</button>
						</article>
					))}
				</div>
			)}
		</div>
	);
}
