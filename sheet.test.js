const test = require("node:test");
const assert = require("node:assert");
const S = require("./sheet.js");

const base = {
  code: "73181588", year: 2026, qty: 100, ourPrice: 2064,
  rivals: S.MARKET_PRICES.rivals.map((r) => ({ ...r, include: r.origin === "TW" })),
  buyerType: "distributor", dataItems: { cn: true, mill: true }, verification: "self",
  clause: { on: true, share: 0.5, cap: 120 },
};

test("2026 한국 7318 15 88 기본값 비용은 검산값 €205.10", () => {
  const s = S.build(base);
  assert.ok(s.ok);
  assert.ok(Math.abs(s.current.cost - 205.10) < 0.01);
  assert.ok(Math.abs(s.total - 20510) < 1);
});

test("대만 대비 판정은 가격 유지, 제안서에는 고른 행만 들어간다", () => {
  const s = S.build(base);
  const tw = s.comparisons.find((c) => c.origin === "TW");
  assert.strictEqual(tw.verdict, "hold");
  assert.deepStrictEqual(s.buyerComparisons.map((c) => c.origin), ["TW"]);
});

test("가격 조항 상한은 2028년에 걸린다", () => {
  const s = S.build(base);
  const y28 = s.clause.find((c) => c.year === 2028);
  assert.strictEqual(y28.capped, true);
  assert.strictEqual(y28.seller, 120);
});

test("CBAM 대상이 아닌 코드는 제안서를 만들지 않는다", () => {
  const s = S.build({ ...base, code: "73170000" });
  assert.strictEqual(s.ok, false);
});

test("우리 단가가 없으면 비교하지 않는다", () => {
  const s = S.build({ ...base, ourPrice: NaN });
  assert.strictEqual(s.comparisons.length, 0);
});
