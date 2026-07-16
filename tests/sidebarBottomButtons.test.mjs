import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/renderer/src/styles.css", "utf8");
const buttonRule = css.match(
  /\.chat-list-pane\.v3-braun \.sidebar-body \.sidebar-bottom-actions \.icon-button \{([\s\S]*?)\n\}/,
)?.[1];
const hoverRule = css.match(
  /\.chat-list-pane\.v3-braun \.sidebar-body \.sidebar-bottom-actions \.icon-button:hover \{([\s\S]*?)\n\}/,
)?.[1];

test("v3 sidebar bottom buttons have no visible border", () => {
  assert.match(buttonRule ?? "", /border:\s*0;/);
  assert.doesNotMatch(hoverRule ?? "", /border-color:/);
});
