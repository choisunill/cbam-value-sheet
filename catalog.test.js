const test = require("node:test");
const assert = require("node:assert");
const K = require("./catalog.js");
const E = require("./engine.js");
const close = (a, b, eps = 0.001) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("한국 7318 15 88 2026: 기존 엔진·검산값과 같다 (€205.10)", () => {
  const r = K.cost({ cn: "73181588", year: 2026, quarter: 3 });
  assert.ok(r.ok);
  close(r.certificates, 2.4915, 0.0001);
  close(r.costPerTonne, 205.10, 0.01);
  for (const year of [2026, 2027, 2028]) {
    const old = E.defaultCost({ productId: "731815-nonstainless", origin: "KR", year, quarter: 3 });
    close(K.cost({ cn: "73181588", year, quarter: 3 }).costPerTonne, old.costPerTonne);
  }
});

test("경쟁국 기본값도 기존 data.js와 같다 (7318 15)", () => {
  const map = { China: 6.375, Taiwan: 2.707, "Türkiye": 5.43, India: 5.72, Japan: 2.8, "Viet Nam": 2.75 };
  for (const [c, v] of Object.entries(map)) close(K.dvFor(c, "73181588").total, v);
});

test("인도 열연(7208) 2026 인증서 약 3.37장: SMM 기사 재현값", () => {
  const r = K.cost({ cn: "72082500", origin: "India", year: 2026, quarter: 3 });
  assert.ok(r.ok, r.reason);
  close(r.certificates, 3.372, 0.002);
});

test("스테인리스 나사는 기간별 벤치마크(2026~27 / 2028~)를 고른다", () => {
  assert.strictEqual(K.benchmarkFor("73181210", null, 2026), 1.154);
  assert.strictEqual(K.benchmarkFor("73181210", null, 2028), 1.116);
});

test("알루미늄 판재는 경로 (L) 벤치마크 0.148을 쓴다", () => {
  const r = K.cost({ cn: "76061191", year: 2026, quarter: 3 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.route, "(L)");
  assert.strictEqual(r.benchmark, 0.148);
  close(r.certificates, 1.95 * 1.1 - 0.975 * 0.148);
});

test("모든 코드·원산지에서 계산하거나 이유를 돌려준다(예외 없음), 비용은 0 이상", () => {
  let ok = 0, no = 0;
  for (const { cn } of K.codes()) {
    for (const origin of [K.KOREA, ...K.origins()]) {
      for (const year of [2026, 2028]) {
        const r = K.cost({ cn, origin, year, quarter: 3 });
        if (r.ok) { ok++; assert.ok(r.costPerTonne >= 0 && Number.isFinite(r.costPerTonne)); } else { no++; assert.ok(r.reason); }
      }
    }
  }
  assert.ok(ok > 10000, "계산된 조합 " + ok);
});

test("한국은 철강·알루미늄 대부분 코드를 계산할 수 있다", () => {
  const all = K.codes();
  const ok = all.filter(({ cn }) => K.cost({ cn, year: 2026, quarter: 3 }).ok).length;
  assert.ok(ok / all.length > 0.9, `${ok}/${all.length}`);
});

test("집행위 원본 값: 바레인 알루미늄 판재 기본값 2.66 (아일랜드 EPA 표는 1.98로 달랐음)", () => {
  assert.strictEqual(K.dvFor("Bahrain", "76061191").total, 2.66);
});

test("경로가 (C)/(F)로 표시된 호는 벤치마크 표에 있는 경로로 정한다 (7205 → C)", () => {
  const r = K.cost({ cn: "72051000", year: 2026, quarter: 3 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.route, "(C)");
});
