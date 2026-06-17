import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FileTreeNode } from "../../shared/types";

const ignoredNames = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", ".venv", "__pycache__"]);

// 文件侧边栏需要能展示常见前端/桌面项目的深层源码目录；保留上限是为了避免误打开超大仓库时递归读取拖慢 UI。
const DEFAULT_FILE_TREE_MAX_DEPTH = 12;

export class FileSystemService {
  async listTree(root: string, maxDepth = DEFAULT_FILE_TREE_MAX_DEPTH): Promise<FileTreeNode[]> {
    return this.readDirectory(root, root, 0, maxDepth);
  }

  private async readDirectory(root: string, current: string, depth: number, maxDepth: number): Promise<FileTreeNode[]> {
    const entries = await readdir(current, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      if (ignoredNames.has(entry.name)) continue;

      const absolutePath = join(current, entry.name);
      const relativePath = relative(root, absolutePath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: absolutePath,
          relativePath,
          type: "directory",
          // 深度达到上限时停止继续递归；上限由默认常量控制，兼顾深层目录展示和大仓库性能。
          children: depth < maxDepth ? await this.readDirectory(root, absolutePath, depth + 1, maxDepth) : [],
        });
      } else if (entry.isFile()) {
        nodes.push({
          name: entry.name,
          path: absolutePath,
          relativePath,
          type: "file",
        });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
}
