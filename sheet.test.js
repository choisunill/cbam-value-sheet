const test = require("node:test");
const assert = require("node:assert");
const S = require("./sheet.js");

const rivals = S.DEFAULT_RIVALS.map((o) => ({
  origin: o, price: S.marketPrice("73181588", o) ?? NaN, duty: S.defaultDuty("73181588", o), include: o === "Taiwan",
}));
const base = {
  code: "73181588", year: 2026, qty: 100, ourPrice: 2064, rivals,
  buyerType: "distributor", dataItems: { cn: true, mill: true }, verification: "self",
  clause: { on: true, share: 0.5, cap: 120 },
};

test("2026 한국 7318 15 88 기본값 비용은 검산값 €205.10", () => {
  const s = S.build(base);
  assert.ok(s.ok);
  assert.ok(Math.abs(s.current.cost - 205.10) < 0.01);
  assert.ok(Math.abs(s.total - 20510) < 1);
});

test("대만 대비 판정은 가격 유지(우리 €2,269 vs 대만 €2,377), 제안서에는 고른 행만", () => {
  const s = S.build(base);
  const tw = s.comparisons.find((c) => c.origin === "Taiwan");
  assert.strictEqual(tw.verdict, "hold");
  assert.strictEqual(Math.round(tw.ourTotal), 2269);
  assert.strictEqual(Math.round(tw.rivalTotal), 2377);
  assert.deepStrictEqual(s.buyerComparisons.map((c) => c.origin), ["Taiwan"]);
});

test("단가가 없는 경쟁국도 CBAM 비용은 나온다 (중국)", () => {
  const cn = S.build(base).rivals.find((r) => r.origin === "China");
  assert.ok(cn.cbam > 400 && !cn.verdict);
});

test("가격 조항 상한은 2028년에 걸린다", () => {
  const y28 = S.build(base).clause.find((c) => c.year === 2028);
  assert.strictEqual(y28.capped, true);
  assert.strictEqual(y28.seller, 120);
});

test("알루미늄 판재도 제안서를 만든다", () => {
  const s = S.build({ ...base, code: "76061191", ourPrice: NaN });
  assert.ok(s.ok);
  assert.strictEqual(s.sector, "aluminium");
});

test("CBAM 대상이 아닌 코드는 이유를 돌려준다", () => {
  const s = S.build({ ...base, code: "73170000" });
  assert.strictEqual(s.ok, false);
  assert.ok(s.reason);
});
