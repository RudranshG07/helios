import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store.ts";

test("initialize seeds the stable holding and equity", () => {
  const s = new Store(":memory:", "USDT");
  s.initialize(1000);
  const p = s.getPortfolio();
  assert.equal(p.equityUsd, 1000);
  assert.equal(p.highWaterUsd, 1000);
  assert.equal(p.tradeCount, 0);
});

test("buy then price drop produces drawdown; sell-all closes the position", () => {
  const s = new Store(":memory:", "USDT");
  s.initialize(1000);

  s.applyFill({ txHash: "t1", token: "WBNB", stableDelta: -200, tokenDelta: 200 / 600, notionalUsd: 200 }, 100, "b1");
  s.markPrices({ WBNB: 600 });
  s.refreshHighWater();
  assert.ok(Math.abs(s.getPortfolio().equityUsd - 1000) < 0.01);

  s.markPrices({ WBNB: 450 });
  const dipped = s.getPortfolio();
  assert.ok(Math.abs(dipped.equityUsd - 950) < 0.01);
  assert.ok(Math.abs(dipped.highWaterUsd - 1000) < 0.01);

  const qty = dipped.positions.find((x) => x.token === "WBNB")!.qtyBase;
  s.applyFill({ txHash: "t2", token: "WBNB", stableDelta: qty * 450, tokenDelta: -qty, notionalUsd: qty * 450 }, 200, "s1");
  const after = s.getPortfolio();
  assert.equal(after.positions.some((x) => x.token === "WBNB"), false);
  assert.equal(after.tradeCount, 2);
});

test("alreadyFilled enforces idempotency", () => {
  const s = new Store(":memory:", "USDT");
  s.initialize(1000);
  assert.equal(s.alreadyFilled("x"), false);
  s.applyFill({ txHash: "t", token: "WBNB", stableDelta: -10, tokenDelta: 10 / 600, notionalUsd: 10 }, 1, "x");
  assert.equal(s.alreadyFilled("x"), true);
});
