// 바이어 제안서(Buyer Value Sheet) 내용을 만드는 순수 함수. 화면과 분리해 테스트한다.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./data.js"), require("./engine.js"), require("./negotiation.js"));
  } else root.CBAM_SHEET = factory(root.CBAM_DATA, root.CBAM_ENGINE, root.CBAM_NEGOTIATION);
})(typeof globalThis !== "undefined" ? globalThis : this, function (D, E, N) {
  const PRODUCT = "731815-nonstainless";
  const YEARS = [2026, 2027, 2028];

  // 2025년 독일 7318 15 88 통관 평균 단가(Eurostat Comext). 다른 코드에는 쓰지 않는다.
  const MARKET_PRICES = {
    code: "73181588",
    source: "Eurostat Comext, 2025 Germany import average, CN 7318 15 88",
    ours: 2064,
    rivals: [
      { origin: "TW", price: 2161, duty: 3.7 },
      { origin: "IN", price: 2158, duty: 3.7 },
      { origin: "TR", price: 3137, duty: 0 },
      { origin: "VN", price: 1428, duty: 0 },
    ],
  };

  // 바이어 유형. 세분화 담당 결과가 나오면 이 목록을 바꾼다. shortcut: 지금은 예시 2개.
  const BUYER_TYPES = {
    distributor: {
      label: "유통사·수입상 (예시)",
      en: "Fastener distributor / importer",
      headline: "Know the CBAM cost of every tonne before you quote.",
      pitch: "As the EU importer you pay CBAM. We give you the cost per tonne, how it moves to 2028, and the data your declaration needs, so you can price without guessing.",
      order: ["cost", "compare", "clause", "data"],
    },
    manufacturer: {
      label: "완제품 제조사 (예시)",
      en: "Manufacturer (automotive / machinery supply chain)",
      headline: "Lower CBAM and supply risk with documented emissions data.",
      pitch: "Purchased fasteners are part of your Scope 3 and CBAM exposure. We document the emissions basis, state its verification status, and fix how CBAM cost is shared.",
      order: ["data", "cost", "clause", "compare"],
    },
  };

  const VERIFICATION = {
    none: { ko: "아직 없음", en: "Not yet available. Default values apply." },
    self: { ko: "자체 산정", en: "Self-estimated (not verified)" },
    pre: { ko: "사전검증", en: "Pre-verified by a third party (non-accredited)" },
    accredited: { ko: "EU 인정 검증", en: "Verified by an EU-accredited verifier" },
  };

  const DATA_ITEMS = {
    cn: { ko: "CN 코드별 물량", en: "Volume by CN code" },
    mill: { ko: "선재 밀 시트(원산지·제철소)", en: "Wire rod mill certificates (origin and steel mill)" },
    volume: { ko: "연간 생산량", en: "Annual production volume" },
    installation: { ko: "공장(설비) 정보", en: "Installation details (site, process)" },
  };

  function costFor(code, year) {
    const r = E.defaultCost({ productId: PRODUCT, origin: "KR", year, quarter: year === 2026 ? 3 : undefined });
    return { year, certificates: r.certificatesPerTonne, cost: r.costPerTonne, priceLabel: r.price.label, priceStatus: r.price.status, notes: r.notes };
  }

  function rivalCost(origin, year) {
    return E.defaultCost({ productId: PRODUCT, origin, year, quarter: year === 2026 ? 3 : undefined }).costPerTonne;
  }

  // state: { code, year, qty, ourPrice, rivals:[{origin, price, duty, include}], buyerType, company, buyer,
  //          dataItems:{...bool}, verification, clause:{on, share(0~1), cap|null} }
  function build(state) {
    const check = E.checkCoverage(state.code);
    if (check.status !== "supported") return { ok: false, coverage: check };

    const years = YEARS.map((y) => costFor(state.code, y));
    const current = years.find((y) => y.year === state.year);
    const qty = Number.isFinite(state.qty) && state.qty > 0 ? state.qty : null;

    const comparisons = Number.isFinite(state.ourPrice) && state.ourPrice > 0
      ? state.rivals
          .filter((r) => Number.isFinite(r.price) && r.price > 0)
          .map((r) => {
            const res = N.compareOne(
              { price: state.ourPrice, dutyRate: 0, cbam: current.cost },
              { price: r.price, dutyRate: r.duty / 100, cbam: rivalCost(r.origin, state.year) }
            );
            return { origin: r.origin, name: D.originNames[r.origin], include: !!r.include, price: r.price, duty: r.duty, ...res };
          })
      : [];

    const clause = state.clause && state.clause.on
      ? YEARS.map((y) => {
          const c = years.find((v) => v.year === y);
          return { year: y, ...N.clauseSplit({ certificates: c.certificates, price: c.cost / c.certificates, share: state.clause.share, cap: state.clause.cap }) };
        })
      : null;

    const type = BUYER_TYPES[state.buyerType] || BUYER_TYPES.distributor;
    const dataProvided = Object.keys(DATA_ITEMS).filter((k) => state.dataItems && state.dataItems[k]).map((k) => DATA_ITEMS[k]);

    return {
      ok: true,
      coverage: check,
      code: state.code,
      year: state.year,
      years,
      current,
      total: qty ? current.cost * qty : null,
      qty,
      comparisons,
      buyerComparisons: comparisons.filter((c) => c.include),
      clause,
      type,
      verification: VERIFICATION[state.verification] || VERIFICATION.none,
      dataProvided,
      marketPricesApply: state.code === MARKET_PRICES.code,
    };
  }

  return { PRODUCT, YEARS, MARKET_PRICES, BUYER_TYPES, VERIFICATION, DATA_ITEMS, build };
});
