// 바이어 제안서(Buyer Value Sheet) 내용을 만드는 순수 함수. 화면과 분리해 테스트한다.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./negotiation.js"), require("./prices-data.js"), require("./duty-data.js"));
  } else root.CBAM_SHEET = factory(root.CBAM_CATALOG, root.CBAM_NEGOTIATION, root.CBAM_PRICES, root.CBAM_DUTY);
})(typeof globalThis !== "undefined" ? globalThis : this, function (K, N, PRICES, DUTY) {
  const YEARS = [2026, 2027, 2028];

  // 시장 평균 단가: 2025년 독일 수입 평균(Eurostat Comext, prices-data.js). 물량 10톤 미만인 원산지·코드는 없다.
  const MARKET_PRICES = { code: "73181588", source: "Eurostat Comext, 2025 Germany import average" };
  // 경쟁국 관세율(%) 기본값. TARIC에서 확인한 7318 15 88 기준, 대만은 MFN 해석. 다른 코드는 사용자가 확인한다.
  const DEFAULT_RIVALS = ["Taiwan", "India", "Türkiye", "Viet Nam", "China", "Japan"];

  // 바이어 진단(STP). 세 질문의 답으로 세그먼트를 정하고, 세그먼트가 제안서의 강조점과 순서를 정한다.
  // shortcut: 분류 규칙은 예시다. 세분화 담당 결과가 나오면 QUESTIONS와 segmentFor만 바꾼다.
  // 수정 재구매: 바이어가 공급 조건과 공급사를 다시 따져 보는 상황. 기존 거래처는 지키고, 신규 제안은 그 틈에 들어간다.
  const RELATION = {
    existing: {
      label: "기존 거래처 (지키기)",
      en: "You already buy from us. CBAM is a reason to review terms, not to change supplier: below is what it costs and how we propose to handle it together.",
      ko: "귀사는 이미 당사와 거래하고 있습니다. CBAM은 공급사를 바꿀 이유가 아니라 조건을 함께 점검할 계기입니다. 비용이 얼마이고 어떻게 함께 다룰지 아래에 정리했습니다.",
    },
    new: {
      label: "신규 제안 (들어가기)",
      en: "CBAM changes the cost of every supplier you use today. If you are reviewing your sources, this sheet lets you compare us on total landed cost and on the data we provide.",
      ko: "CBAM은 귀사가 지금 쓰는 모든 공급사의 비용을 바꿉니다. 공급처를 다시 검토하신다면, 이 자료로 당사를 총조달비용과 제공 자료 기준에서 비교해 보실 수 있습니다.",
    },
  };
  const relationOf = (state) => (state.buyerProfile && RELATION[state.buyerProfile.relation] ? state.buyerProfile.relation : "existing");

  // 차별화: 가격·탄소 말고 드리는 가치. 사실인 것만 사용자가 고른다.
  const VALUE_ITEMS = {
    relationship: { ko: "지속적인 거래 관계와 전담 담당자", en: "An established relationship and a dedicated contact" },
    lead: { ko: "안정적인 납기", en: "Reliable lead times" },
    supply: { ko: "안정적인 원소재 공급망", en: "A stable raw material supply chain" },
    quality: { ko: "품질 인증과 검사 성적서 제공", en: "Quality certificates and inspection reports" },
    support: { ko: "CBAM 신고에 필요한 자료 지원", en: "Support with the data for your CBAM declaration" },
  };

  const QUESTIONS = {
    industry: { ko: "업종", options: { distributor: "유통·수입상", manufacturer: "자동차·기계 부품 제조", construction: "건설·프로젝트" } },
    purpose: { ko: "구매 목적", options: { resale: "재판매", production: "생산에 투입", project: "프로젝트 납품" } },
    exposure: { ko: "규제 노출 (바이어의 연간 CBAM 품목 수입)", options: { high: "50톤 넘음", low: "50톤 이하일 수 있음", unknown: "모름" } },
  };

  const SEGMENTS = {
    cost: {
      label: "비용 중심",
      why: "재판매용으로 사서 단가와 총조달비용이 가장 중요한 바이어예요. 비용 → 경쟁 비교 순서로 보여 줘요.",
      headline: "Know the CBAM cost of every tonne before you quote.",
      pitch: "As the EU importer you pay CBAM. We give you the cost per tonne, how it moves to 2028, and the data your declaration needs, so you can price without guessing.",
      headlineKo: "톤마다 CBAM 비용을 미리 알고 견적하세요.",
      pitchKo: "CBAM은 EU 수입자인 귀사가 냅니다. 톤당 비용, 2028년까지의 변화, 신고에 필요한 자료를 드려 추측 없이 가격을 정할 수 있게 합니다.",
      order: ["cost", "compare", "clause", "values", "roles", "data"],
    },
    risk: {
      label: "위험·신뢰 중심",
      why: "생산에 투입하거나 공급망 탄소를 관리하는 바이어예요. 배출 근거와 검증 상태를 먼저 보여 줘요.",
      headline: "Lower CBAM and supply risk with documented emissions data.",
      pitch: "Purchased steel and aluminium parts are part of your Scope 3 and CBAM exposure. We document the emissions basis, state its verification status, and fix how CBAM cost is shared.",
      headlineKo: "배출 근거 자료로 CBAM 비용과 공급 위험을 줄이세요.",
      pitchKo: "구매하는 철강·알루미늄 부품은 귀사의 Scope 3 배출과 CBAM 부담에 들어갑니다. 배출 산정 근거와 검증 상태를 문서로 드리고, CBAM 비용 분담 방식을 정해 둡니다.",
      order: ["data", "values", "cost", "clause", "roles", "compare"],
    },
    certainty: {
      label: "비용 확정 중심",
      why: "프로젝트 기간에 비용이 바뀌면 안 되는 바이어예요. 가격 조항으로 CBAM 비용을 고정하는 것부터 보여 줘요.",
      headline: "Fix the CBAM cost for the life of your project.",
      pitch: "CBAM rises every year to 2028. We quote it separately with a fixed share and a cap per tonne, so your project budget does not move with the default mark-up.",
      headlineKo: "프로젝트 기간의 CBAM 비용을 미리 고정하세요.",
      pitchKo: "CBAM은 2028년까지 해마다 오릅니다. CBAM을 단가와 따로 견적하고 분담률과 톤당 상한을 정해, 할증이 올라도 프로젝트 예산이 흔들리지 않게 합니다.",
      order: ["clause", "cost", "compare", "values", "roles", "data"],
    },
  };

  function segmentFor(b = {}) {
    if (b.purpose === "project" || b.industry === "construction") return "certainty";
    if (b.esg || (b.purpose === "production" && b.industry === "manufacturer")) return "risk";
    return "cost";
  }

  const VERIFICATION = {
    none: { ko: "아직 없음", koLong: "아직 없음. 기본값이 적용됩니다.", en: "Not yet available. Default values apply." },
    self: { ko: "자체 산정", koLong: "자체 산정 (검증 전)", en: "Self-estimated (not verified)" },
    pre: { ko: "사전검증", koLong: "제3자 사전검증 (EU 인정 기관 아님)", en: "Pre-verified by a third party (non-accredited)" },
    accredited: { ko: "EU 인정 검증", koLong: "EU 인정 검증기관의 검증 완료", en: "Verified by an EU-accredited verifier" },
  };

  const DATA_ITEMS = {
    cn: { ko: "CN 코드별 물량", en: "Volume by CN code" },
    mill: { ko: "원소재 밀 시트(원산지·제조사)", en: "Mill certificates for input steel or aluminium (origin and producer)" },
    volume: { ko: "연간 생산량", en: "Annual production volume" },
    installation: { ko: "공장(설비) 정보", en: "Installation details (site, process)" },
  };

  const q = (year) => (year === 2026 ? 3 : undefined);

  // 우리 단가를 넣으면 경쟁국의 관세율 기본값을 채워 주는 데 쓴다.
  // 관세율(%): EU TARIC 기준(duty-data.js). 반덤핑·상계관세·수입금지가 걸린 원산지와 자료가 없는 코드는 null.
  function defaultDuty(code, origin) {
    const d = DUTY[code];
    if (!d || d.x.includes(origin)) return null;
    return origin in d.p ? d.p[origin] : d.b;
  }
  // 무역구제 조치가 걸려 세율을 비워 둔 원산지인지
  function dutyFlag(code, origin) { return !!(DUTY[code] && DUTY[code].x.includes(origin)); }
  function marketPrice(code, origin) {
    return (PRICES[code] && PRICES[code][origin]) ?? null;
  }

  // state: { code, year, qty, ourPrice, rivals:[{origin, price, duty, include}], buyerProfile:{industry,purpose,exposure,esg}, roles, company, buyer,
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
      segment: segmentFor(state.buyerProfile),
      type: SEGMENTS[segmentFor(state.buyerProfile)],
      lowExposure: !!(state.buyerProfile && state.buyerProfile.exposure === "low"),
      roles: state.roles !== false,
      relation: relationOf(state),
      relationText: RELATION[relationOf(state)],
      values: Object.keys(VALUE_ITEMS).filter((k) => state.values && state.values[k]).map((k) => VALUE_ITEMS[k]),
      verification: VERIFICATION[state.verification] || VERIFICATION.none,
      dataProvided: Object.keys(DATA_ITEMS).filter((k) => state.dataItems && state.dataItems[k]).map((k) => DATA_ITEMS[k]),
      // 제안서에 넣은 단가가 모두 시장 평균 그대로일 때만 출처를 적는다
      marketPricesApply: state.ourPrice === marketPrice(state.code, K.KOREA) && rivals.filter((r) => r.verdict && r.include).every((r) => r.price === marketPrice(state.code, r.origin)),
    };
  }

  // 규제 진단(TradeGuard 연계). 확인된 규정만 적는다. level: ok | warn | info
  function regCheck(s, state) {
    if (!s.ok) return [{ level: "warn", text: s.reason }];
    const sectorKo = s.sector === "aluminium" ? "알루미늄" : "철강";
    const items = [
      { level: "ok", text: `CBAM 대상 품목이에요 (${sectorKo}).` },
      { level: "ok", text: `한국산 공식 기본값 ${+s.defaultValue.toFixed(3)} tCO2e/톤${s.route ? ", 생산경로 " + s.route : ""}로 계산했어요.` },
      state.buyerProfile && state.buyerProfile.exposure === "low"
        ? { level: "warn", text: "바이어의 연간 CBAM 품목 수입이 50톤 이하면 CBAM이 면제될 수 있어요. 이 경우 비용 분담 요구의 근거가 약해요." }
        : { level: "info", text: "바이어의 연간 CBAM 품목 수입이 50톤 이하면 면제될 수 있어요. 우리 물량만으로는 판단할 수 없어요." },
      { level: "info", text: "실제 배출값은 EU 인정 검증을 받아야 쓸 수 있고, 첫 검증보고서는 2027년 1월부터 가능해요. 이 도구는 기본값만 씁니다." },
      dutyFlag(s.code, K.KOREA)
        ? { level: "warn", text: "이 코드는 한국산에도 반덤핑 등 무역구제 조치가 걸려 있을 수 있어요. TARIC에서 확인하세요. 비교표의 한국 관세 0%가 맞지 않을 수 있어요." }
        : defaultDuty(s.code, K.KOREA) === 0
          ? { level: "ok", text: "한국산 관세 0% (EU TARIC 조회, 한-EU FTA는 원산지 요건을 채워야 적용)." }
          : { level: "info", text: "이 코드의 한국산 관세율 자료가 없어요. TARIC에서 확인하세요." },
      ...(DUTY[s.code] && DUTY[s.code].q ? [{ level: "warn", text: `철강 관세할당(쿼터)을 넘는 물량에는 추가관세 ${DUTY[s.code].q}%가 붙어요. 비교표는 쿼터 안 물량 기준이에요.` }] : []),
      { level: "info", text: "바이어 신고를 도우려면 CN 코드별 물량, 원소재 밀 시트, 생산량을 준비하세요." },
    ];
    return items;
  }

  return { YEARS, MARKET_PRICES, DEFAULT_RIVALS, QUESTIONS, SEGMENTS, segmentFor, RELATION, VALUE_ITEMS, VERIFICATION, DATA_ITEMS, defaultDuty, dutyFlag, marketPrice, build, regCheck };
});
