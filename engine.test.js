// 실행: node --test engine.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");

const BOLT = "731815-nonstainless";
const Q3 = { year: 2026, quarter: 3 };
const near = (actual, expected, digits = 2) =>
  assert.equal(actual.toFixed(digits), expected.toFixed(digits));
const fromParts = ({ see, benchmark, year, price }) =>
  E.certificates({ see, benchmark, year }).n * price;

test("볼트 2026 Q3 기본값: 한국 €205.10, 인증서 2.4915장", () => {
  const r = E.defaultCost({ productId: BOLT, origin: "KR", ...Q3 });
  near(r.costPerTonne, 205.1);
  near(r.certificatesPerTonne, 2.4915, 4);
  assert.equal(r.price.status, "published");
});

test("볼트 경쟁국 기본값 비용이 조사 표와 일치", () => {
  const expected = { CN: 467.79, TW: 135.65, TR: 382.22, IN: 408.48, JP: 144.07, VN: 139.54, GB: 141.35, US: 124.15 };
  for (const [origin, cost] of Object.entries(expected)) {
    near(E.defaultCost({ productId: BOLT, origin, ...Q3 }).costPerTonne, cost);
  }
});

test("기본값 비교는 한국이 불리해도 그대로 보여 준다", () => {
  const { rows } = E.compareDefaults({ productId: BOLT, ...Q3 });
  const names = rows.map((r) => r.origin);
  assert.ok(names.indexOf("TW") < names.indexOf("KR"));
  assert.ok(names.indexOf("JP") < names.indexOf("KR"));
  assert.ok(names.indexOf("VN") < names.indexOf("KR"));
  assert.ok(names.indexOf("KR") < names.indexOf("CN"));
});

test("혼합·실제 경로가 조사 표와 일치", () => {
  const input = { productId: BOLT, processEmissions: 0.196, inputPerOutput: 1.176, ...Q3 };
  near(E.mixedCost({ ...input, applyMarkupToPrecursor: false }).costPerTonne, 89.38);
  near(E.mixedCost(input).costPerTonne, 109.88); // 조사 노트의 109.89는 중간값 반올림 차이
  near(E.actualCost({ see: 2.039, benchmark: 1.499, ...Q3 }).costPerTonne, 47.54);
});

test("독립 자료: EFDA 대만 7318 14 99 예시 €131.85", () => {
  near(fromParts({ see: 2.978, benchmark: 1.364, year: 2026, price: 80 }), 131.85);
});

test("앞선 보고서: 열연 한국 기본값 €81.83과 가상 제품의 연도별 비용", () => {
  near(fromParts({ see: 2.118 * 1.1, benchmark: 1.37, year: 2026, price: 82.32 }), 81.83);
  near(fromParts({ see: 2.2, benchmark: 1.37, year: 2026, price: 80 }), 69.14);
  near(fromParts({ see: 2.2, benchmark: 1.37, year: 2030, price: 80 }), 119.56);
  near(fromParts({ see: 1.2, benchmark: 1.37, year: 2030, price: 80 }), 39.56);
  near(fromParts({ see: 2.2, benchmark: 1.37, year: 2034, price: 80 }), 176);
});

test("공제선 아래는 0장이고 음수가 되지 않는다", () => {
  const r = E.actualCost({ see: 1.2, benchmark: 1.37, ...Q3 });
  assert.equal(r.certificatesPerTonne, 0);
  assert.equal(r.costPerTonne, 0);
  assert.ok(r.notes.some((n) => n.includes("0장")));
});

test("할증은 2026 10%, 2027 20%, 2028 이후 30%", () => {
  const see = (year) => E.defaultCost({ productId: BOLT, origin: "KR", year }).see;
  near(see(2026), 3.474 * 1.1, 4);
  near(see(2027), 3.474 * 1.2, 4);
  near(see(2028), 3.474 * 1.3, 4);
  near(see(2035), 3.474 * 1.3, 4);
});

test("미공표 가격은 가정으로 표시하고, 시나리오 가격을 우선한다", () => {
  assert.equal(E.resolvePrice({ year: 2026, quarter: 4 }).status, "assumed");
  assert.equal(E.resolvePrice({ year: 2030 }).status, "assumed");
  const r = E.resolvePrice({ year: 2030, scenarioPrice: 100 });
  assert.equal(r.status, "scenario");
  assert.equal(r.value, 100);
});

test("2027년 이후 결과에는 벤치마크 가정을 표시한다", () => {
  const later = E.defaultCost({ productId: BOLT, origin: "KR", year: 2027 });
  assert.ok(later.notes.some((n) => n.includes("개정 벤치마크")));
  const now = E.defaultCost({ productId: BOLT, origin: "KR", ...Q3 });
  assert.ok(!now.notes.some((n) => n.includes("개정 벤치마크")));
});

test("대상 확인", () => {
  assert.equal(E.checkCoverage("7318 15 88").status, "supported");
  assert.equal(E.checkCoverage("73181535").status, "covered_unsupported");
  assert.equal(E.checkCoverage("73170020").status, "not_covered");
  assert.equal(E.checkCoverage("7208").status, "unknown");
  assert.equal(E.checkCoverage("73").status, "invalid");
});

test("호가에 CBAM 포함 여부를 모르면 합계를 내지 않는다", () => {
  const base = { price: 4067, cbamPerTonne: 205.1, dutyRate: 0 };
  assert.equal(E.buyerCost(base).total, null);
  near(E.buyerCost({ ...base, priceIncludesCbam: false }).total, 4272.1);
  near(E.buyerCost({ ...base, priceIncludesCbam: true }).total, 4067);
});

test("검증비 회수 물량", () => {
  near(E.paybackTonnes({ verificationCost: 5000, savingPerTonne: 115.72 }), 43.21);
  near(E.paybackTonnes({ verificationCost: 50000, savingPerTonne: 95.21 }), 525.15);
  near(E.paybackTonnes({ verificationCost: 5000, savingPerTonne: 100, passThrough: 0.5 }), 100);
  assert.equal(E.paybackTonnes({ verificationCost: 5000, savingPerTonne: 0 }), null);
});

test("50톤 이하 안내와 잘못된 입력", () => {
  assert.equal(E.totalCost(205.1, 50).notes.length, 1);
  assert.equal(E.totalCost(205.1, 100).notes.length, 0);
  near(E.totalCost(205.1, 100).total, 20510);
  assert.throws(() => E.totalCost(205.1, -1));
  assert.throws(() => E.defaultCost({ productId: BOLT, origin: "XX", ...Q3 }));
  assert.throws(() => E.defaultCost({ productId: "없음", origin: "KR", ...Q3 }));
  assert.throws(() => E.defaultCost({ productId: BOLT, origin: "KR", year: 2025 }));
  assert.throws(() => E.mixedCost({ productId: BOLT, processEmissions: 0.2, inputPerOutput: 1.2, precursorOrigin: "CN", ...Q3 }));
});
