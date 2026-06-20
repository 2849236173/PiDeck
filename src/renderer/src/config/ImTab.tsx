/**
 * ImTab — 外部链接配置选项卡
 *
 * 在配置弹窗中集中管理外部 IM/Bot 连接（当前支持飞书/Lark）。
 * 样式统一使用配置页的设计 tokens。
 */

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { ConfirmDialog } from "../components/app/AppParts";
import type {
	FeishuBotConfig,
	FeishuBridgeStatus,
	FeishuChatBinding,
	FeishuTestResult,
} from "../../../shared/types";
import { t } from "../i18n";

type Props = {
	onSave?: () => void;
};

const SCOPES_JSON = `{
  "scopes": {
    "tenant": [
      "application:application:self_manage",
      "application:bot.basic_info:read",
      "application:bot.menu:write",
      "cardkit:card:read",
      "cardkit:card:write",
      "contact:contact.base:readonly",
      "docs:document.comment:create",
      "docs:document.comment:delete",
      "docs:document.comment:read",
      "docs:document.comment:update",
      "docs:document.comment:write_only",
      "docx:document.block:convert",
      "docx:document:readonly",
      "docx:document:write_only",
      "drive:drive.metadata:readonly",
      "im:chat.members:bot_access",
      "im:chat:create",
      "im:chat:read",
      "im:chat:update",
      "im:message.group_at_msg.include_bot:readonly",
      "im:message.group_at_msg:readonly",
      "im:message.group_msg",
      "im:message.p2p_msg:readonly",
      "im:message.pins:read",
      "im:message.pins:write_only",
      "im:message.reactions:read",
      "im:message.reactions:write_only",
      "im:message:readonly",
      "im:message:send_as_bot",
      "im:message:send_multi_users",
      "im:message:send_sys_msg",
      "im:message:update",
      "im:resource",
      "wiki:node:read"
    ],
    "user": [
      "offline_access"
    ]
  }
}`;

const EVENTS_JSON = `[
  "im.chat.member.bot.added_v1",
  "im.chat.member.bot.deleted_v1",
  "im.message.reaction.created_v1",
  "im.message.reaction.deleted_v1",
  "im.message.receive_v1",
  "drive.notice.comment_add_v1",
  "vc.meeting.participant_meeting_ended_v1",
  "vc.note.generated_v1",
  "minutes.minute.generated_v1"
]`;

type FeishuApiRaw = {
	botsList?: () => Promise<FeishuBotConfig[]>;
	statusRequest?: () => Promise<FeishuBridgeStatus>;
	bindingsList?: () => Promise<FeishuChatBinding[]>;
	onStatus?: (cb: (s: FeishuBridgeStatus) => void) => () => void;
	connect?: (input: { appId: string; appSecret: string; name: string }) => Promise<{ success: boolean; message: string }>;
	connectByBot?: (botId: string) => Promise<{ success: boolean; message: string }>;
	disconnect?: () => Promise<unknown>;
	botAdd?: (input: { appId: string; appSecret: string; name?: string; defaultUserOpenId?: string }) => Promise<{ success: boolean; bot?: FeishuBotConfig; error?: string }>;
	botRemove?: (botId: string) => Promise<boolean>;
	botSecret?: (botId: string) => Promise<string>;
	testConnection?: (appId: string, appSecret: string) => Promise<FeishuTestResult>;
	bindingRemove?: (chatId: string) => Promise<boolean>;
	botConfig?: (botId: string, patch: Partial<FeishuBotConfig>) => Promise<FeishuBotConfig | undefined>;
};

export function ImTab(_props: Props) {
	const [bots, setBots] = useState<FeishuBotConfig[]>([]);
	const [status, setStatus] = useState<FeishuBridgeStatus>({ status: "disconnected", activeBindings: 0 });
	const [bindings, setBindings] = useState<FeishuChatBinding[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [visibleBots, setVisibleBots] = useState(5);
	const [visibleBindingsByBot, setVisibleBindingsByBot] = useState<Record<string, number>>({});
	const [appId, setAppId] = useState("");
	const [appSecret, setAppSecret] = useState("");
	const [botName, setBotName] = useState("");
	const [adding, setAdding] = useState(false);
	const [testResult, setTestResult] = useState<FeishuTestResult | null>(null);
	const [testing, setTesting] = useState(false);
	const [expandedBotIds, setExpandedBotIds] = useState<Set<string>>(new Set());
	const [addFormOpenId, setAddFormOpenId] = useState("");
	const [editingOpenIdBotId, setEditingOpenIdBotId] = useState<string | null>(null);
	const [editOpenIdValue, setEditOpenIdValue] = useState("");
	const [deleteConfirmBotId, setDeleteConfirmBotId] = useState<string | null>(null);
	const [guideOpen, setGuideOpen] = useState(false);
	const [copiedScope, setCopiedScope] = useState(false);
	const [copiedEvents, setCopiedEvents] = useState(false);
	const [copiedCredential, setCopiedCredential] = useState<string | null>(null);
	const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
	const [guideAnimating, setGuideAnimating] = useState(false);

	const api = (window as unknown as { piDesktop?: { feishu?: FeishuApiRaw } }).piDesktop?.feishu;

	const loadData = useCallback(async () => {
		if (!api) { setLoading(false); return; }
		setLoading(true);
		setError(null);
		try {
			const [botsList, statusRes, bindingsList] = await Promise.all([
				api.botsList?.(),
				api.statusRequest?.(),
				api.bindingsList?.(),
			]);
			setBots(botsList ?? []);
			setStatus(statusRes ?? { status: "disconnected", activeBindings: 0 });
			setBindings(bindingsList ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		void loadData();
	}, [loadData]);

	useEffect(() => {
		if (!api) return;
		return api.onStatus?.(setStatus);
	}, [api]);

	const handleTest = useCallback(async () => {
		if (!api || !appId.trim() || !appSecret.trim()) return;
		setTesting(true);
		setTestResult(null);
		try {
			const result = await api.testConnection!(appId.trim(), appSecret.trim());
			setTestResult(result);
		} catch (e) {
			setTestResult({ success: false, message: e instanceof Error ? e.message : String(e) });
		} finally {
			setTesting(false);
		}
	}, [api, appId, appSecret]);

	const handleAddBot = useCallback(async () => {
		if (!api || !appId.trim() || !appSecret.trim()) return;
		setAdding(true);
		try {
			const result = await api.botAdd!({
				appId: appId.trim(),
				appSecret: appSecret.trim(),
				name: botName.trim() || t("config.im.botDefaultName"),
				defaultUserOpenId: addFormOpenId.trim() || undefined,
			});
			if (result.success) {
				setAppId("");
				setAppSecret("");
				setBotName("");
				setAddFormOpenId("");
				setShowAddForm(false);
				setTestResult(null);
				await loadData();
			} else {
				setError(result.error ?? t("config.im.addFailed"));
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setAdding(false);
		}
	}, [api, appId, appSecret, botName, addFormOpenId, loadData]);

	const handleRemoveBot = useCallback(async (botId: string) => {
		if (!api) return;
		await api.botRemove!(botId);
		await loadData();
	}, [api, loadData]);

	const handleEditOpenId = useCallback(async (botId: string) => {
		if (!api) return;
		await api.botConfig!(botId, { defaultUserOpenId: editOpenIdValue.trim() || undefined });
		setEditingOpenIdBotId(null);
		await loadData();
	}, [api, editOpenIdValue, loadData]);

	const handleRemoveBinding = useCallback(async (chatId: string) => {
		if (!api) return;
		await api.bindingRemove!(chatId);
		await loadData();
	}, [api, loadData]);

	const handleCopyValue = useCallback(async (key: string, value: string) => {
		await navigator.clipboard.writeText(value);
		setCopiedCredential(key);
		setTimeout(() => setCopiedCredential(null), 1600);
	}, []);

	const handleLoadSecret = useCallback(async (botId: string) => {
		if (!api?.botSecret) return "";
		const cached = revealedSecrets[botId];
		if (cached) return cached;
		const secret = await api.botSecret(botId);
		setRevealedSecrets((prev) => ({ ...prev, [botId]: secret }));
		return secret;
	}, [api, revealedSecrets]);

	const handleCopySecret = useCallback(async (botId: string) => {
		const secret = await handleLoadSecret(botId);
		if (secret) await handleCopyValue(`secret:${botId}`, secret);
	}, [handleCopyValue, handleLoadSecret]);

	const handleRevealSecret = useCallback(async (botId: string) => {
		await handleLoadSecret(botId);
	}, [handleLoadSecret]);

	const getVisibleBindingsForBot = useCallback((botId: string) => visibleBindingsByBot[botId] ?? 10, [visibleBindingsByBot]);

	const isConnected = bindings.length > 0;
	const statusLabel = t(`config.im.status.${status.status}` as any) || status.status;

	if (loading) {
		return <div className="config-loading">{t("common.loading")}</div>;
	}

	return (
		<div className="config-im-tab">
			{/* ── 全局连接状态提示 ── */}
			{isConnected && (
				<div className="config-im-status-bar">
					<span className="config-im-status-dot connected" />
					<div className="config-im-status-info">
						<div className="config-im-status-title">
							{t("config.im.linkedAgentsCount", { count: bindings.length })}
						</div>
						<div className="config-im-status-meta">
							{t("config.im.activeBindings", { count: bindings.length })}
						</div>
						{status.errorMessage && (
							<div className="config-im-status-error">{status.errorMessage}</div>
						)}
					</div>
				</div>
			)}

			{status.status === "error" && status.errorMessage && (
				<div className="config-im-message warn">{status.errorMessage}</div>
			)}

			{error && (
				<div className="config-im-error">
					<span>{error}</span>
					<button className="config-icon-btn" onClick={() => setError(null)}>×</button>
				</div>
			)}

			{/* ── 单 Bot 连接提示 ── */}
			<div className="config-im-hint">
				{t("config.im.singleConnectionHint")}
			</div>

			{/* ── Bot 配置管理 ── */}
			<div className="config-section">
				<div className="config-toolbar">
					<span className="config-count">{t("config.im.botConfig", { count: bots.length })}</span>
					<div className="config-toolbar-actions">
						<button
							className="config-btn"
							onClick={() => setGuideOpen(true)}
						>
							{t("config.im.guide")}
						</button>
						<a
							href="https://xid01i1952l.feishu.cn/wiki/Yf8Gw5QW3is7xdkuG98cvRVen5d?from=from_copylink"
							target="_blank"
							rel="noreferrer"
							className="config-btn"
						>
							{t("config.im.onlineGuide")}
						</a>
						<button
							className="config-btn primary"
							onClick={() => { setShowAddForm((v) => !v); setTestResult(null); setAppId(""); setAppSecret(""); setBotName(""); setAddFormOpenId(""); }}
						>
							{showAddForm ? t("common.cancel") : t("config.im.addBot")}
						</button>
					</div>
				</div>

				{showAddForm && (
					<div className="config-im-form">
						<div className="config-field">
							<label>{t("config.im.appId")}</label>
							<input
								type="text"
								value={appId}
								onChange={(e) => { setAppId(e.target.value); setTestResult(null); }}
								placeholder="cli_xxxxxxxxxxxx"
								className="config-input"
							/>
						</div>
						<div className="config-field">
							<label>{t("config.im.appSecret")}</label>
							<input
								type="password"
								value={appSecret}
								onChange={(e) => { setAppSecret(e.target.value); setTestResult(null); }}
								placeholder="••••••••••••••••"
								className="config-input"
							/>
						</div>
						<div className="config-field">
							<label>{t("config.im.botName")} <span className="config-field-optional">({t("common.optional")})</span></label>
							<input
								type="text"
								value={botName}
								onChange={(e) => setBotName(e.target.value)}
								placeholder={t("config.im.botNamePlaceholder")}
								className="config-input"
							/>
						</div>
						<div className="config-field">
							<label>{t("config.im.openId")} <span className="config-field-optional">({t("common.optional")})</span></label>
							<input
								type="text"
								value={addFormOpenId}
								onChange={(e) => setAddFormOpenId(e.target.value)}
								placeholder="ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
								className="config-input"
							/>
							<span className="config-field-hint">{t("config.im.openIdHint")}</span>
						</div>

						{testResult && (
							<div className={`config-im-test-result ${testResult.success ? "success" : "warn"}`}>
								{testResult.success ? "✅ " : "⚠️ "}{testResult.message}
							</div>
						)}

						<div className="config-im-form-actions">
							<button
								className="config-btn"
								onClick={handleTest}
								disabled={testing || !appId.trim() || !appSecret.trim()}
							>
								{testing ? t("config.im.testing") : t("config.im.testConnection")}
							</button>
							<button
								className="config-btn primary"
								onClick={handleAddBot}
								disabled={adding || !appId.trim() || !appSecret.trim()}
							>
								{adding ? t("config.im.saving") : t("common.save")}
							</button>
						</div>
					</div>
				)}

				{bots.length === 0 && !showAddForm && (
					<div className="config-empty">{t("config.im.noBotConfig")}</div>
				)}

				{bots.slice(0, visibleBots).map((bot) => {
					const botBindings = bindings.filter((binding) => binding.botId === bot.id);
					const isThisConnected = botBindings.length > 0;
					const isEditingOpenId = editingOpenIdBotId === bot.id;
					const isExpanded = expandedBotIds.has(bot.id);
					const visibleBindingCount = getVisibleBindingsForBot(bot.id);
					const visibleBotBindings = botBindings.slice(0, visibleBindingCount);
					const secretValue = revealedSecrets[bot.id];
					return (
						<div key={bot.id} className={`config-card config-im-bot-card${isThisConnected ? " connected" : ""}`}>
							<div
								className="config-card-header config-im-bot-header"
								onClick={() => setExpandedBotIds((prev) => {
									const next = new Set(prev);
									if (next.has(bot.id)) next.delete(bot.id);
									else next.add(bot.id);
									return next;
								})}
							>
								<div className="config-card-info">
									<div className="config-card-name">
										<span className="config-im-expand-caret">{isExpanded ? "▾" : "▸"}</span>
										{bot.name}
										{isThisConnected && <span className="config-im-connected-badge">{t("config.im.connected")}</span>}
									</div>
									<div className="config-card-meta">
										{t("config.im.expandHint")} · {t("config.im.appId")}: {bot.appId.slice(0, 14)}… · {t("config.im.linkedAgentsCount", { count: botBindings.length })}
									</div>
								</div>
								<div className="config-card-actions" onClick={(e) => e.stopPropagation()}>
									<button
										className="config-btn"
										onClick={() => {
											setExpandedBotIds((prev) => {
												const next = new Set(prev);
												if (next.has(bot.id)) next.delete(bot.id);
												else next.add(bot.id);
												return next;
											});
										}}
									>
										{isExpanded ? t("common.collapse") : t("common.details")}
									</button>
									<button className="config-btn danger-fill" onClick={() => setDeleteConfirmBotId(bot.id)}>
										{t("common.delete")}
									</button>
								</div>
							</div>
							{isExpanded && (
								<div className="config-card-details config-im-bot-details" onClick={(e) => e.stopPropagation()}>
									<div className="config-im-bot-detail-section">
										<div className="config-im-section-title">{t("config.im.appCredentials")}</div>
										<div className="config-im-credential-grid">
											<div className="config-im-credential-card">
												<span>{t("config.im.appId")}</span>
												<code>{bot.appId}</code>
												<button className="config-btn small" onClick={() => handleCopyValue(`appid:${bot.id}`, bot.appId)}>
													{copiedCredential === `appid:${bot.id}` ? t("common.copied") : t("common.copy")}
												</button>
											</div>
											<div className="config-im-credential-card">
												<span>{t("config.im.appSecret")}</span>
												<code>{secretValue || t("config.im.secretHidden")}</code>
												<div className="config-im-credential-actions">
													<button className="config-btn small" onClick={() => handleCopySecret(bot.id)}>
														{copiedCredential === `secret:${bot.id}` ? t("common.copied") : t("common.copy")}
													</button>
													<button
														className="config-btn small"
														onClick={() => {
															if (secretValue) {
																setRevealedSecrets((prev) => {
																	const next = { ...prev };
																	delete next[bot.id];
																	return next;
																});
															} else {
															void handleRevealSecret(bot.id);
															}
														}}
													>
														{secretValue ? t("config.im.hideSecret") : t("config.im.revealSecret")}
													</button>
												</div>
											</div>
										</div>
									</div>

									<div className="config-im-bot-detail-section">
										<div className="config-im-section-title">{t("config.im.openId")}</div>
										{isEditingOpenId ? (
											<div className="config-im-openid-edit">
												<input
													type="text"
													value={editOpenIdValue}
													onChange={(e) => setEditOpenIdValue(e.target.value)}
													placeholder="ou_xxxxxxxxxxxx"
													className="config-input config-input-xs"
												/>
												<button className="config-btn primary small" onClick={() => handleEditOpenId(bot.id)}>{t("common.save")}</button>
												<button className="config-btn small" onClick={() => setEditingOpenIdBotId(null)}>{t("common.cancel")}</button>
											</div>
										) : (
											<div className="config-im-openid-line">
												{bot.defaultUserOpenId ? <code>{bot.defaultUserOpenId}</code> : <span className="config-im-openid-empty">{t("config.im.openIdEmpty")}</span>}
												<button className="config-btn small" onClick={() => { setEditingOpenIdBotId(bot.id); setEditOpenIdValue(bot.defaultUserOpenId || ""); }}>
													{t("config.im.editOpenId")}
												</button>
											</div>
										)}
									</div>

									<div className="config-im-bot-detail-section">
										<div className="config-im-section-title">{t("config.im.linkedAgents", { count: botBindings.length })}</div>
										{botBindings.length === 0 ? (
											<div className="config-empty config-im-inline-empty">{t("config.im.noBotBindings")}</div>
										) : (
											<div className="config-im-binding-list">
												{visibleBotBindings.map((binding) => (
													<div key={binding.chatId} className="config-im-binding-row">
														<div className="config-im-binding-avatar">{binding.chatType === "p2p" ? "💬" : "👥"}</div>
														<div className="config-im-binding-info">
															<div className="config-im-binding-title">{binding.groupName || binding.chatId.slice(0, 10)}</div>
															<div className="config-im-binding-meta">
																{t("config.im.agentId")}: {binding.sessionId.slice(0, 8)} · {t("config.im.chat")}: {binding.chatId.slice(0, 10)} · {new Date(binding.createdAt).toLocaleString()}
															</div>
														</div>
														<button className="config-btn danger-fill small" onClick={() => handleRemoveBinding(binding.chatId)}>
															{t("config.im.disconnect")}
														</button>
													</div>
												))}
												{botBindings.length > visibleBindingCount && (
													<button
														className="config-btn small config-im-show-more"
														onClick={() => setVisibleBindingsByBot((prev) => ({ ...prev, [bot.id]: Math.min((prev[bot.id] ?? 10) + 10, botBindings.length) }))}
													>
														{t("config.im.showMoreAgents")} ({botBindings.length - visibleBindingCount})
													</button>
												)}
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					);
				})}
				{bots.length > visibleBots && (
					<button className="config-btn small" style={{ marginTop: 4 }} onClick={() => setVisibleBots((v) => Math.min(v + 5, bots.length))}>
						{t("common.showMore")} ({bots.length - visibleBots})
					</button>
				)}
			</div>

			{/* ── 删除确认弹窗 ── */}
			{deleteConfirmBotId && (
				<ConfirmDialog
					title={t("config.im.confirmDeleteBot")}
					message={t("config.im.deleteBotMessage")}
					danger
					confirmLabel={t("common.delete")}
					onConfirm={() => {
						const botId = deleteConfirmBotId;
						setDeleteConfirmBotId(null);
						void handleRemoveBot(botId);
					}}
					onCancel={() => setDeleteConfirmBotId(null)}
				/>
			)}

			{/* ── 配置指南弹窗 ── */}
			{guideOpen && (
				<div
					className={`config-im-guide-overlay${guideAnimating ? " closing" : ""}`}
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setGuideAnimating(true);
							setTimeout(() => { setGuideAnimating(false); setGuideOpen(false); }, 150);
						}
					}}
				>
					<div className="config-im-guide-modal">
						<div className="config-im-guide-modal-header">
							<strong>{t("config.im.guide")}</strong>
							<button
								className="config-icon-btn"
								onClick={() => { setGuideAnimating(true); setTimeout(() => { setGuideAnimating(false); setGuideOpen(false); }, 150); }}
							>
								<X size={16} strokeWidth={2.2} />
							</button>
						</div>
						<div className="config-im-guide-modal-body">
							<p><strong>{t("config.im.guideMethodTitle")}</strong></p>

							{/* 方式一：智能体（推荐） */}
							<p><strong>{t("config.im.guideMethodA")}</strong></p>
							<p style={{ fontSize: "var(--font-size-micro)", color: "var(--color-text-tertiary)" }}>{t("config.im.guideMethodADesc")}</p>
							<ol>
								<li>{t("config.im.guideMethodAStep1a")}<br /><a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer" style={{ whiteSpace: "nowrap" }}>https://open.feishu.cn/app</a> → {t("config.im.guideMethodAStep1b")}</li>
								<li>{t("config.im.guideMethodAStep2")}</li>
								<li>{t("config.im.guideMethodAStep3")}</li>
								<li>{t("config.im.guideMethodAStep4")}</li>
							</ol>

							{/* 方式二：开放平台（手动） */}
							<p style={{ marginTop: 16 }}><strong>{t("config.im.guideMethodB")}</strong></p>
							<p style={{ fontSize: "var(--font-size-micro)", color: "var(--color-text-tertiary)" }}>{t("config.im.guideMethodBDesc")}</p>
							<ol>
								<li>{t("config.im.guideMethodBStep1a")}<br /><a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer" style={{ whiteSpace: "nowrap" }}>https://open.feishu.cn/app</a> → {t("config.im.guideMethodBStep1b")}</li>
								<li>{t("config.im.guideMethodBStep2")}</li>
								<li>{t("config.im.guideMethodBStep3")}<br />
									<ul className="config-im-guide-perms">
										<li><code>im:message:send_as_bot</code> — {t("config.im.permSendMessage")}</li>
										<li><code>im:message.p2p_msg:readonly</code> — {t("config.im.permGetMessageP2P")}</li>
										<li><code>im:message.group_at_msg:readonly</code> — {t("config.im.permGetMessageGroup")}</li>
										<li><code>im:message:update</code> — {t("config.im.permUpdateMessage")}</li>
										<li><code>im:chat:read</code> / <code>im:chat:create</code> / <code>im:chat:update</code> — {t("config.im.permChatManage")}</li>
										<li><code>im:resource</code> — {t("config.im.permDownload")}</li>
										<li><code>contact:contact.base:readonly</code> — {t("config.im.permContact")}</li>
									</ul>
								</li>
								<li>{t("config.im.guideMethodBStep4")}</li>
								<li>{t("config.im.guideMethodBStep5")}</li>
								<li>{t("config.im.guideMethodBStep6")}</li>
								<li>{t("config.im.guideMethodAStep4")}</li>
							</ol>

							<p className="config-im-guide-note">{t("config.im.guideGroupChat")}</p>

							{/* 可复制的权限和作用域 */}
							<p style={{ marginTop: 20, fontWeight: 600 }}>{t("config.im.guideScopeTitle")}</p>
							<p style={{ fontSize: "var(--font-size-micro)", color: "var(--color-text-tertiary)" }}>{t("config.im.guideScopeDesc")}</p>
							<pre className="config-im-code-block">{SCOPES_JSON}</pre>
							<button className="config-btn small" onClick={() => { navigator.clipboard.writeText(SCOPES_JSON); setCopiedScope(true); setTimeout(() => setCopiedScope(false), 2000); }}>
								{copiedScope ? t("common.copied") : t("common.copy")}
							</button>

							<p style={{ marginTop: 20, fontWeight: 600 }}>{t("config.im.guideEventsTitle")}</p>
							<p style={{ fontSize: "var(--font-size-micro)", color: "var(--color-text-tertiary)" }}>{t("config.im.guideEventsDesc")}</p>
							<pre className="config-im-code-block">{EVENTS_JSON}</pre>
							<button className="config-btn small" onClick={() => { navigator.clipboard.writeText(EVENTS_JSON); setCopiedEvents(true); setTimeout(() => setCopiedEvents(false), 2000); }}>
								{copiedEvents ? t("common.copied") : t("common.copy")}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
