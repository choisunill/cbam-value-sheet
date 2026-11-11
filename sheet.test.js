const test = require("node:test");
const assert = require("node:assert");
const S = require("./sheet.js");

const rivals = S.DEFAULT_RIVALS.map((o) => ({
  origin: o, price: S.marketPrice("73181588", o) ?? NaN, duty: S.defaultDuty("73181588", o), include: o === "Taiwan",
}));
const base = {
  code: "73181588", year: 2026, qty: 100, ourPrice: 2064, rivals,
  buyerProfile: { industry: "distributor", purpose: "resale", exposure: "high", esg: false }, dataItems: { cn: true, mill: true }, verification: "self",
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

test("단가가 없는 경쟁국도 CBAM 비용은 나온다", () => {
  const st = { ...base, rivals: [{ origin: "China", price: NaN, duty: 3.7, include: false }] };
  const cn = S.build(st).rivals[0];
  assert.ok(cn.cbam > 400 && !cn.verdict);
});

test("시장 단가: 검산값과 같고(한국 2064, 대만 2161), 다른 코드도 채워진다", () => {
  const KR = "Korea, Republic of (South Korea)";
  assert.strictEqual(S.marketPrice("73181588", KR), 2064);
  assert.strictEqual(S.marketPrice("73181588", "Taiwan"), 2161);
  assert.strictEqual(S.marketPrice("73181588", "Viet Nam"), 1428);
  assert.ok(S.marketPrice("73181520", "India") > 0);
  assert.strictEqual(S.marketPrice("73181520", KR), null); // 한국산 0.2톤: 10톤 미만이라 없음
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

test("바이어 진단: 재판매 유통사는 비용, 생산 투입 제조사는 위험, 프로젝트는 비용 확정", () => {
  assert.strictEqual(S.segmentFor({ industry: "distributor", purpose: "resale" }), "cost");
  assert.strictEqual(S.segmentFor({ industry: "manufacturer", purpose: "production" }), "risk");
  assert.strictEqual(S.segmentFor({ industry: "distributor", purpose: "resale", esg: true }), "risk");
  assert.strictEqual(S.segmentFor({ industry: "construction", purpose: "resale" }), "certainty");
  assert.strictEqual(S.build({ ...base, buyerProfile: { purpose: "project" } }).type.order[0], "clause");
});

test("규제 진단: 50톤 이하일 수 있으면 경고", () => {
  const st = { ...base, buyerProfile: { exposure: "low" } };
  const items = S.regCheck(S.build(st), st);
  assert.ok(items.some((i) => i.level === "warn" && i.text.includes("50톤")));
  const en = S.regCheck(S.build(st), st, true);
  assert.strictEqual(en.length, items.length);
  assert.ok(en.every((i) => !/[가-힣]/.test(i.text)), "영어판에 한국어가 남지 않는다");
});

test("협상 메일: 판정별 문장과 숫자", () => {
  const M = require("./messages.js");
  const s = S.build(base);
  const tw = s.comparisons.find((c) => c.origin === "Taiwan");
  const en = M.email(s, tw, { lang: "en", company: "A", buyer: "B", clause: base.clause });
  assert.match(en.body, /keep our current price/);
  assert.match(en.body, /€2,269/);
  const ko = M.email(s, tw, { lang: "ko", clause: base.clause });
  assert.match(ko.body, /현재 단가를 유지/);
  const non = M.email(s, { ...tw, verdict: "nonprice" }, { lang: "en", clause: base.clause });
  const match = M.email(s, { ...tw, verdict: "match", needed: 50, share: 0.25 }, { lang: "en", clause: base.clause });
  assert.match(match.body, /price reduction of €50 per tonne/);
  assert.match(match.body, /we bear 50%/); // 제안서 조항과 같은 비율을 대안으로 적는다
  assert.doesNotMatch(non.body, /quality|lead time/); // 고르지 않은 가치는 약속하지 않는다
  const sv = S.build({ ...base, values: { lead: true } });
  assert.match(M.email(sv, { ...tw, verdict: "nonprice" }, { lang: "en", clause: base.clause }).body, /Beyond price, we offer: reliable lead times\./);
  assert.doesNotMatch(non.body, /€2,377/); // 가격 외 경쟁일 때 경쟁국 총비용을 바이어에게 알리지 않는다
});

test("관세율: 조사로 확인한 값과 같다 (7318 15 88)", () => {
  assert.strictEqual(S.defaultDuty("73181588", "Taiwan"), 3.7);
  assert.strictEqual(S.defaultDuty("73181588", "India"), 3.7);
  assert.strictEqual(S.defaultDuty("73181588", "Türkiye"), 0);
  assert.strictEqual(S.defaultDuty("73181588", "Viet Nam"), 0);
  assert.strictEqual(S.defaultDuty("73181588", "Korea, Republic of (South Korea)"), 0);
  assert.strictEqual(S.defaultDuty("73181588", "China"), null); // 반덤핑
  assert.ok(S.dutyFlag("73181588", "China"));
  assert.strictEqual(S.defaultDuty("72082500", "India"), 0); // 열연, 기본세율 0%
});

test("수정 재구매: 관계에 따라 제안서 머리말과 메일 첫 문장이 바뀐다", () => {
  const M = require("./messages.js");
  const ex = S.build(base), nw = S.build({ ...base, buyerProfile: { ...base.buyerProfile, relation: "new" } });
  assert.strictEqual(ex.relation, "existing"); // 값이 없으면 기존 거래처
  assert.strictEqual(nw.relation, "new");
  assert.notStrictEqual(ex.relationText.ko, nw.relationText.ko);
  assert.match(M.email(nw, null, { lang: "ko", relation: nw.relation, clause: base.clause }).body, /비교 대상/);
  assert.match(M.email(ex, null, { lang: "en", relation: ex.relation, clause: base.clause }).body, /your continued business/);
});

test("가격 외 가치: 고른 항목만 제안서에 들어간다", () => {
  assert.strictEqual(S.build(base).values.length, 0);
  const s = S.build({ ...base, values: { lead: true, quality: true, supply: false } });
  assert.deepStrictEqual(s.values.map((v) => v.ko), ["안정적인 납기", "품질 인증과 검사 성적서 제공"]);
  assert.ok(s.type.order.includes("values"));
});

test("판정 제외: 단가가 2배를 넘는 원산지와 한국산 관세가 불확실한 코드", () => {
  const s = S.build(base);
  const jp = s.rivals.find((r) => r.origin === "Japan");
  assert.ok(jp.outlier && !jp.verdict); // 일본 평균 단가 €18,526 대 우리 €2,064
  assert.ok(!s.comparisons.some((c) => c.origin === "Japan"));
  assert.ok(S.dutyFlag("72191100", "Korea, Republic of (South Korea)"));
  const k = S.build({ ...base, code: "72191100", rivals: [{ origin: "Taiwan", price: 2000, duty: 0, include: true }] });
  if (k.ok) { assert.ok(k.koreaDutyUnknown); assert.strictEqual(k.comparisons.length, 0); }
});

test("협상 메일: 바이어 유형에 따라 제안서에서 볼 것을 다르게 안내한다", () => {
  const M = require("./messages.js");
  const mail = (profile) => { const s = S.build({ ...base, buyerProfile: profile }); return M.email(s, null, { lang: "en", clause: base.clause }).body; };
  assert.match(mail({ purpose: "resale" }), /total landed cost per tonne/);
  assert.match(mail({ esg: true }), /verification status/);
  assert.match(mail({ purpose: "project" }), /budget for your project/);
});
