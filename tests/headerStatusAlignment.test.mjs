import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync("src/renderer/src/App.tsx", "utf8");
const css = readFileSync("src/renderer/src/styles.css", "utf8");

test("header status cards share the right-aligned actions group", () => {
  const actionsIndex = appSource.indexOf("chat-header-actions");
  const agentIdIndex = appSource.indexOf('className="chat-agent-id"');
  const sessionStatusIndex = appSource.indexOf("<SessionStatus");

  assert.ok(agentIdIndex > actionsIndex, "Agent ID must be inside header actions");
  assert.ok(agentIdIndex < sessionStatusIndex, "Agent ID must precede runtime status cards");
  assert.match(css, /\.chat-header-actions > \.chat-agent-id \{\s*margin-left:\s*auto;/);
  assert.match(css, /\.header-actions-right \{[\s\S]*?margin-left:\s*0;/);
});
