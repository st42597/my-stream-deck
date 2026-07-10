#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let nextTimerId = 1;
const activeTimers = new Set();
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

globalThis.setInterval = () => {
  const id = nextTimerId++;
  activeTimers.add(id);
  return id;
};
globalThis.clearInterval = (id) => {
  activeTimers.delete(id);
};

let failed = 0;
function assert(condition, label) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    console.error(`  FAIL ${label}`);
    failed++;
  }
}

try {
  const { BasePollingAction } = await import(path.join(root, "src/actions/basePollingAction.ts"));

  class TestPollingAction extends BasePollingAction {
    async updateDisplay() {}
  }

  const action = new TestPollingAction();
  const event = {
    action: { isKey: () => true },
    payload: { settings: { refreshSeconds: 60 } },
  };

  await action.onWillAppear(event);
  assert(activeTimers.size === 1, "first appearance starts one polling timer");

  await action.onWillAppear(event);
  assert(activeTimers.size === 1, "reappearance replaces the existing polling timer");

  action.onWillDisappear(event);
  assert(activeTimers.size === 0, "disappearance clears every polling timer");
} finally {
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
}

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
