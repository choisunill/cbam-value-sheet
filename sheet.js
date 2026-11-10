// 바이어 제안서(Buyer Value Sheet) 내용을 만드는 순수 함수. 화면과 분리해 테스트한다.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./negotiation.js"));
  } else root.CBAM_SHEET = factory(root.CBAM_CATALOG, root.CBAM_NEGOTIATION);
})(typeof globalThis !== "undefined" ? globalThis : this, function (K, N) {
  const YEARS = [2026, 2027, 2028];

  // 2025년 독일 7318 15 88 통관 평균 단가(Eurostat Comext). 다른 코드에는 쓰지 않는다.
  const MARKET_PRICES = {
    code: "73181588",
    source: "Eurostat Comext, 2025 Germany import average, CN 7318 15 88",
    ours: 2064,
    prices: { Taiwan: 2161, India: 2158, "Türkiye": 3137, "Viet Nam": 1428 },
  };
  // 경쟁국 관세율(%) 기본값. TARIC에서 확인한 7318 15 88 기준, 대만은 MFN 해석. 다른 코드는 사용자가 확인한다.
  const DUTY_7318 = { Taiwan: 3.7, India: 3.7, "Türkiye": 0, "Viet Nam": 0, China: 3.7, Japan: 0 };
  const DEFAULT_RIVALS = ["Taiwan", "India", "Türkiye", "Viet Nam", "China", "Japan"];

  // 바이어 유형. 세분화 담당 결과가 나오면 이 목록을 바꾼다. shortcut: 지금은 예시 2개.
  const BUYER_TYPES = {
    distributor: {
      label: "유통사·수입상 (예시)",
      headline: "Know the CBAM cost of every tonne before you quote.",
      pitch: "As the EU importer you pay CBAM. We give you the cost per tonne, how it moves to 2028, and the data your declaration needs, so you can price without guessing.",
      order: ["cost", "compare", "clause", "data"],
    },
    manufacturer: {
      label: "완제품 제조사 (예시)",
      headline: "Lower CBAM and supply risk with documented emissions data.",
      pitch: "Purchased steel and aluminium parts are part of your Scope 3 and CBAM exposure. We document the emissions basis, state its verification status, and fix how CBAM cost is shared.",
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
    mill: { ko: "원소재 밀 시트(원산지·제조사)", en: "Mill certificates for input steel or aluminium (origin and producer)" },
    volume: { ko: "연간 생산량", en: "Annual production volume" },
    installation: { ko: "공장(설비) 정보", en: "Installation details (site, process)" },
  };

  const q = (year) => (year === 2026 ? 3 : undefined);

  // 우리 단가를 넣으면 경쟁국의 관세율 기본값을 채워 주는 데 쓴다.
  function defaultDuty(code, origin) {
    return code.startsWith("731815") && DUTY_7318[origin] != null ? DUTY_7318[origin] : null;
  }
  function marketPrice(code, origin) {
    return code === MARKET_PRICES.code ? MARKET_PRICES.prices[origin] ?? null : null;
  }

  // state: { code, year, qty, ourPrice, rivals:[{origin, price, duty, include}], buyerType, company, buyer,
  //          dataItems:{...bool}, verification, clause:{on, share(0~1), cap|null} }
  function build(state) {
    const now = K.cost({ cn: state.code, year: state.year, quarter: q(state.year) });
    if (!now.ok) return { ok: false, reason: now.reason };

    const years = YEARS.map((y) => {
      const r = K.cost({ cn: state.code, year: y, quarter: q(y) });
      return { year: y, certificates: r.certificates, cost: r.costPerTonne, benchmark: r.benchmark, markup: K.MARKUP[y] };
    });
    const current = years.find((y) => y.year === state.year);
    const qty = Number.isFinite(state.qty) && state.qty > 0 ? state.qty : null;

    // 경쟁국 CBAM은 공식 기본값으로 늘 계산한다. 단가가 있으면 바이어 총비용 판정까지 한다.
    const rivals = state.rivals.map((r) => {
      const rc = K.cost({ cn: state.code, origin: r.origin, year: state.year, quarter: q(state.year) });
      const base = { origin: r.origin, nameKo: K.nameKo(r.origin), nameEn: K.nameEn(r.origin), include: !!r.include, price: r.price, duty: r.duty, cbam: rc.ok ? rc.costPerTonne : null, cbamReason: rc.ok ? null : rc.reason, defaultValue: rc.ok ? rc.defaultValue : null };
      const priced = rc.ok && Number.isFinite(r.price) && r.price > 0 && Number.isFinite(r.duty) && Number.isFinite(state.ourPrice) && state.ourPrice > 0;
      if (!priced) return base;
      return { ...base, ...N.compareOne({ price: state.ourPrice, dutyRate: 0, cbam: current.cost }, { price: r.price, dutyRate: r.duty / 100, cbam: rc.costPerTonne }) };
    });

    const clause = state.clause && state.clause.on
      ? years.map((c) => ({ year: c.year, ...N.clauseSplit({ certificates: c.certificates, price: c.cost / c.certificates || 0, share: state.clause.share, cap: state.clause.cap }) }))
      : null;

    return {
      ok: true,
      code: state.code,
      sector: now.cn && K.codes().find((c) => c.cn === state.code).sector,
      desc: K.codes().find((c) => c.cn === state.code).desc,
      defaultValue: now.defaultValue,
      route: now.route,
      price: now.price,
      year: state.year,
      years,
      current,
      total: qty ? current.cost * qty : null,
      qty,
      rivals,
      comparisons: rivals.filter((r) => r.verdict),
      buyerComparisons: rivals.filter((r) => r.verdict && r.include),
      clause,
      type: BUYER_TYPES[state.buyerType] || BUYER_TYPES.distributor,
      verification: VERIFICATION[state.verification] || VERIFICATION.none,
      dataProvided: Object.keys(DATA_ITEMS).filter((k) => state.dataItems && state.dataItems[k]).map((k) => DATA_ITEMS[k]),
      marketPricesApply: state.code === MARKET_PRICES.code,
    };
  }

  return { YEARS, MARKET_PRICES, DEFAULT_RIVALS, BUYER_TYPES, VERIFICATION, DATA_ITEMS, defaultDuty, marketPrice, build };
});
