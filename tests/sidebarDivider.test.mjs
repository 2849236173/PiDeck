import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/renderer/src/styles.css", "utf8");

const v3SidebarRule = css.match(
  /\.wechat-shell:not\(\.list-collapsed\) \.chat-list-pane\.v3-braun,\n\.list-collapsed:not\(\.list-hover-suppressed\) \.chat-list-pane\.v3-braun:hover,\n\.list-collapsed:not\(\.list-hover-suppressed\) \.chat-list-pane\.v3-braun:focus-within \{([\s\S]*?)\n\}/,
)?.[1];

test("v3 sidebar has no right divider in expanded or revealed states", () => {
  assert.ok(v3SidebarRule, "v3 sidebar surface rule must exist");
  assert.doesNotMatch(v3SidebarRule, /border-right:/);
});
