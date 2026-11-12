import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = await mkdtemp(join(tmpdir(), "ppf-growth-budget-"));
process.env.BUDGET_STATE_PATH = join(dir, "state.json");
const { reserveSpend, settleSpend, releaseSpend, budgetSnapshot } = await import("../src/budget.mjs");

test("enforces daily and monthly limits and records settled spend", async () => {
  await reserveSpend({ id: "one", amountRub: 1200, channel: "test", purpose: "daily cap" });
  await assert.rejects(
    reserveSpend({ id: "two", amountRub: 400, channel: "test", purpose: "over daily cap" }),
    /дневной лимит/
  );
  await settleSpend({ id: "one", actualRub: 1100 });
  const b = await budgetSnapshot();
  assert.equal(b.spentRub, 1100);
  assert.equal(b.dailySpentRub, 1100);
  assert.equal(b.monthlyRemainingRub, 28900);
});

test("releases unused reservation", async () => {
  await reserveSpend({ id: "cancel", amountRub: 300, channel: "test", purpose: "cancel" });
  await releaseSpend("cancel", "test cancellation");
  const b = await budgetSnapshot();
  assert.equal(b.reservedRub, 0);
});

test.after(async () => { await rm(dir, { recursive: true, force: true }); });
