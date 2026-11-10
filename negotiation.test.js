const test = require("node:test");
const assert = require("node:assert");
const { compareOne, clauseSplit } = require("./negotiation.js");

const ours = { price: 2064, dutyRate: 0, cbam: 205.1 };

test("대만보다 총비용이 낮으면 분담 없이 버틸 수 있다", () => {
  const r = compareOne(ours, { price: 2161, dutyRate: 0.037, cbam: 135.66 });
  assert.equal(r.verdict, "hold");
  assert.ok(Math.abs(r.room - 108.5) < 1);
});

test("차이가 CBAM보다 작으면 그만큼 분담하면 맞춰진다", () => {
  const r = compareOne({ ...ours, price: 2300 }, { price: 2161, dutyRate: 0.037, cbam: 135.66 });
  assert.equal(r.verdict, "match");
  assert.ok(Math.abs(r.needed - 128.5) < 0.1);
});

test("차이가 CBAM 전액보다 크면 가격으로는 못 맞춘다", () => {
  assert.equal(compareOne(ours, { price: 1428, dutyRate: 0, cbam: 139.54 }).verdict, "nonprice");
});

test("관세가 있으면 필요한 단가 인하가 관세만큼 줄어든다", () => {
  const r = compareOne({ price: 1000, dutyRate: 0.1, cbam: 100 }, { price: 1000, dutyRate: 0, cbam: 150 });
  assert.ok(Math.abs(r.needed - 50 / 1.1) < 1e-9);
});

test("가격 조항은 상한에서 멈춘다", () => {
  const r = clauseSplit({ certificates: 3.2886, price: 82.32, share: 0.5, cap: 120 });
  assert.equal(r.seller, 120);
  assert.ok(r.capped);
  assert.equal(clauseSplit({ certificates: 2.4915, price: 82.32, share: 0.5, cap: null }).capped, false);
});
