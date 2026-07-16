import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/renderer/src/styles.css", "utf8");
const agentIdRule = css.match(/\.chat-agent-id \{([\s\S]*?)\n\}/)?.[1];
const titleRowRule = css.match(/\.chat-title-row \{([\s\S]*?)\n\}/)?.[1];

test("agent ID card is 28px tall and remains vertically centered with the title", () => {
  assert.match(agentIdRule ?? "", /height:\s*28px;/);
  assert.match(titleRowRule ?? "", /align-items:\s*center;/);
});
