import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { PiRpcClient } from "./PiRpcClient";
import { PiLocator } from "./PiLocator";
import type { AppSettings } from "../../shared/types";

type PiProcessSettings = Pick<
  AppSettings,
  "piProxyEnabled" | "piProxyUrl" | "piProxyBypass" | "customPiPath"
>;

export class PiProcess extends EventEmitter {
  private proc?: ChildProcessWithoutNullStreams;
  private rpc?: PiRpcClient;
  /** 标记进程是否在预热池中（park 后为 true，复用前需 reset） */
  private parked = false;

  constructor(
    private readonly cwd: string,
    private readonly settings?: PiProcessSettings,
  ) {
    super();
  }

  /** 判断当前进程是否匹配指定的 cwd，用于预热池查找 */
  matches(targetCwd: string): boolean {
    return this.cwd === targetCwd && this.isRunning();
  }

  /** 放回预热池：只 abort 当前操作 + 重置到新 session，不杀进程 */
  park() {
    if (!this.proc || !this.rpc) return;
    this.parked = true;
    this.rpc.notify({ type: "abort" });
    this.rpc.request({ type: "new_session" }).catch(() => {});
  }

  /** 从预热池取出复用：清除 parked 标记 */
  unpark() {
    this.parked = false;
  }

  /** 是否在预热池中 */
  isParked(): boolean {
    return this.parked;
  }

  start(sessionPath?: string) {
    if (this.proc) return this.rpc!;

    const args = ["--mode", "rpc", ...(sessionPath ? ["--session", sessionPath] : [])];
    const locator = new PiLocator();
    // 用户手动指定的 pi 路径优先于自动检测，解决 npm global、nvm 等路径未在 PATH 中的问题
    const command = locator.resolveCommand(this.settings?.customPiPath);
    const invocation = locator.createInvocation(command, args);

    // 每个 agent 绑定独立 cwd，确保 pi 自己发现项目级 AGENTS.md、settings 和 session 分组。
    // 打包后的 Electron 不一定继承用户终端 PATH；这里补齐跨平台 Node 工具链常见 bin 目录，尽量让已安装 pi 的用户开箱即用。
    // Windows 下通过 PiLocator.createInvocation 显式包裹含空格的 npm shim 路径，避免 cmd 拆分路径导致 agent 启动失败。
    this.proc = spawn(invocation.command, invocation.args, {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: invocation.shell,
      env: locator.createProcessEnv(this.settings, invocation.pathPrefix),
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    });

    this.rpc = new PiRpcClient(this.proc.stdin, this.proc.stdout);

    this.rpc.on("event", event => this.emit("event", event));
    this.rpc.on("protocol-error", line => this.emit("protocol-error", line));
    // 转发 RPC 日志到 AgentManager，用于前端调试面板展示
    this.rpc.on("log", entry => this.emit("rpc-log", entry));

    this.proc.stderr.on("data", chunk => {
      // stderr 不属于 RPC 协议，单独暴露给 UI 的日志面板，避免污染 JSONL stdout。
      this.emit("stderr", chunk.toString("utf8"));
    });

    this.proc.on("error", error => this.emit("error", error));
    this.proc.on("exit", (code, signal) => {
      this.rpc?.close(new Error(`pi exited: code=${code ?? "null"}, signal=${signal ?? "null"}`));
      this.emit("exit", { code, signal });
      this.proc = undefined;
      this.rpc = undefined;
    });

    return this.rpc;
  }

  get client() {
    if (!this.rpc) throw new Error("pi process is not running");
    return this.rpc;
  }

  isRunning(): boolean {
    return this.proc !== undefined && this.rpc !== undefined;
  }

  stop() {
    if (!this.proc) return;
    // 预热池中的进程不要 kill，由池子管理生命周期
    if (this.parked) return;
    this.proc.kill();
  }
}
