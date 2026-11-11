// 바이어 제안서(Buyer Value Sheet) 내용을 만드는 순수 함수. 화면과 분리해 테스트한다.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./negotiation.js"), require("./prices-data.js"), require("./duty-data.js"), require("./data.js"));
  } else root.CBAM_SHEET = factory(root.CBAM_CATALOG, root.CBAM_NEGOTIATION, root.CBAM_PRICES, root.CBAM_DUTY, root.CBAM_DATA);
})(typeof globalThis !== "undefined" ? globalThis : this, function (K, N, PRICES, DUTY, DATA) {
  const YEARS = [2026, 2027, 2028];

  // 시장 평균 단가: 2025년 독일 수입 평균(Eurostat Comext, prices-data.js). 물량 10톤 미만인 원산지·코드는 없다.
  const MARKET_PRICES = { code: "73181588", source: "Eurostat Comext, 2025 Germany import average (CIF, before duty)" }; // 수입 통계값은 신고국 국경 CIF, 관세·세금 제외
  // 경쟁국 관세율(%) 기본값. TARIC에서 확인한 7318 15 88 기준, 대만은 MFN 해석. 다른 코드는 사용자가 확인한다.
  const DEFAULT_RIVALS = ["Taiwan", "India", "Türkiye", "Viet Nam", "China", "Japan"];

  // 바이어 진단(STP). 세 질문의 답으로 세그먼트를 정하고, 세그먼트가 제안서의 강조점과 순서를 정한다.
  // shortcut: 분류 규칙은 예시다. 세분화 담당 결과가 나오면 QUESTIONS와 segmentFor만 바꾼다.
  // 수정 재구매: 바이어가 공급 조건과 공급사를 다시 따져 보는 상황. 기존 거래처는 지키고, 신규 제안은 그 틈에 들어간다.
  const RELATION = {
    existing: {
      label: "기존 거래처",
      en: "This sheet sets out what CBAM adds to the cost of our existing business and how we propose to handle it.",
      ko: "귀사와의 기존 거래에 CBAM으로 추가되는 비용과 당사의 처리 방안을 아래에 정리했습니다.",
    },
    new: {
      label: "신규 거래처",
      en: "If you are reviewing your sources, this sheet lets you compare us on total landed cost and on the data we provide.",
      ko: "공급처를 검토하실 때 당사를 총조달비용과 제공 자료 기준으로 비교하실 수 있도록 정리했습니다.",
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
    exposure: { ko: "바이어의 연간 CBAM 품목 수입량", options: { high: "50톤 초과", low: "50톤 이하 가능", unknown: "미확인" } },
  };

  const SEGMENTS = {
    cost: {
      label: "비용 중심",
      why: "재판매 목적. 단가와 총조달비용을 먼저 봅니다. 제안서는 비용, 원산지 비교 순입니다.",
      headline: "CBAM cost per tonne and total landed cost",
      pitch: "As the EU importer, you pay CBAM. This sheet gives the cost per tonne, how it changes to 2028, and the data your declaration needs.",
      headlineKo: "톤당 CBAM 비용과 총조달비용 안내",
      pitchKo: "CBAM은 EU 수입자인 귀사가 납부합니다. 톤당 비용, 2028년까지의 변화, 신고에 필요한 자료를 정리했습니다.",
      order: ["cost", "compare", "clause", "values", "roles", "data"],
    },
    risk: {
      label: "위험·신뢰 중심",
      why: "생산 투입 또는 공급망 탄소 관리 대상. 제안서는 배출 근거와 검증 상태부터 보여 줍니다.",
      headline: "Emissions basis and verification status",
      pitch: "Purchased steel and aluminium parts count towards your CBAM cost and Scope 3 emissions. This sheet sets out the emissions basis, its verification status, and how CBAM cost is shared.",
      headlineKo: "배출 산정 근거와 검증 상태 안내",
      pitchKo: "구매하는 철강·알루미늄 부품은 귀사의 CBAM 부담과 Scope 3 배출에 포함됩니다. 배출 산정 근거, 검증 상태, CBAM 비용 분담 방식을 정리했습니다.",
      order: ["data", "values", "cost", "clause", "roles", "compare"],
    },
    certainty: {
      label: "비용 확정 중심",
      why: "프로젝트 기간의 비용 변동을 피해야 하는 바이어. 제안서는 가격 조항부터 보여 줍니다.",
      // 상한은 공급사 몫에만 걸린다. 바이어 몫은 해마다 오르므로 "비용 고정"이라고 쓰지 않는다.
      headline: "Proposed terms for sharing CBAM cost",
      pitch: "CBAM cost rises each year to 2028. We quote CBAM separately from the unit price and propose a fixed share with a cap per tonne.",
      headlineKo: "CBAM 비용 분담 조건 제안",
      pitchKo: "CBAM 비용은 2028년까지 해마다 오릅니다. CBAM을 단가와 따로 견적하고, 당사 분담률과 톤당 상한을 정해 제안합니다.",
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

    // 한국산에 무역구제 조치가 걸린 코드는 한국 관세 0%를 믿을 수 없어 판정하지 않는다.
    const koreaDutyUnknown = dutyFlag(state.code, K.KOREA);
    // 경쟁국 CBAM은 공식 기본값으로 늘 계산한다. 단가가 있으면 바이어 총비용 판정까지 한다.
    const rivals = state.rivals.map((r) => {
      const rc = K.cost({ cn: state.code, origin: r.origin, year: state.year, quarter: q(state.year) });
      const base = { origin: r.origin, nameKo: K.nameKo(r.origin), nameEn: K.nameEn(r.origin), include: !!r.include, price: r.price, duty: r.duty, cbam: rc.ok ? rc.costPerTonne : null, cbamReason: rc.ok ? null : rc.reason, defaultValue: rc.ok ? rc.defaultValue : null };
      const priced = rc.ok && Number.isFinite(r.price) && r.price > 0 && Number.isFinite(r.duty) && Number.isFinite(state.ourPrice) && state.ourPrice > 0;
      if (!priced || koreaDutyUnknown) return base;
      // 단가가 우리의 2배를 넘으면 같은 코드 안의 다른 제품군일 수 있어 판정하지 않는다.
      if (r.price > 2 * state.ourPrice) return { ...base, outlier: true };
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
      koreaDutyUnknown,
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

  // 인증서 가격 기준과 낡았는지. 분기 가격은 분기가 끝난 다음 첫 주에 공표되므로, 다음 분기 말 + 7일이 지나면 새 값이 나왔다고 본다.
  // shortcut: 자동으로 받아 오지 않는다(서버 없음). 새 값은 data.js를 고쳐서 넣는다.
  function priceStatus(today = new Date()) {
    const [y, q] = DATA.latestPublishedPrice.period.split("Q").map(Number);
    const due = Date.UTC(y, q * 3 + 3, 0) + 7 * 864e5;
    return { year: y, quarter: q, asOf: DATA.asOf, stale: today.getTime() > due };
  }

  // 규제 진단(TradeGuard 연계). 확인된 규정만 적는다. level: ok | warn | info. en이 참이면 영어 문구.
  function regCheck(s, state, en, today) {
    if (!s.ok) return [{ level: "warn", text: s.reason }];
    const L = (ko, e) => (en ? e : ko);
    const sector = s.sector === "aluminium" ? L("알루미늄", "aluminium") : L("철강", "steel");
    const dv = +s.defaultValue.toFixed(3);
    const items = [
      { level: "ok", text: L(`CBAM 대상 품목 (${sector})`, `Covered by CBAM (${sector}).`) },
      { level: "ok", text: L(`한국산 공식 기본값 ${dv} tCO2e/톤${s.route ? ", 생산경로 " + s.route : ""} 적용`, `Korea's official default value applied: ${dv} tCO2e/t${s.route ? ", production route " + s.route : ""}`) },
      state.buyerProfile && state.buyerProfile.exposure === "low"
        ? { level: "warn", text: L("바이어의 연간 CBAM 품목 수입이 50톤 이하면 CBAM이 면제될 수 있습니다. 이 경우 비용 분담 요구의 근거가 약합니다.", "If the buyer imports 50 tonnes or less of CBAM goods a year, it may be exempt from CBAM. A request to share the cost then has weak grounds.") }
        : { level: "info", text: L("바이어의 연간 CBAM 품목 수입이 50톤 이하면 면제될 수 있습니다. 바이어에게 확인이 필요합니다.", "If the buyer imports 50 tonnes or less of CBAM goods a year, it may be exempt. Confirm with the buyer.") },
      { level: "info", text: L("실제 배출값은 EU 인정 검증 후 사용할 수 있습니다. 첫 검증보고서는 2027년 1월부터 가능합니다. 이 도구는 기본값만 사용합니다.", "Actual emissions can be used only after EU-accredited verification, and the first verification reports are possible from January 2027. This tool uses default values only.") },
      dutyFlag(s.code, K.KOREA)
        ? { level: "warn", text: L("한국산에도 반덤핑 등 무역구제 조치가 있을 수 있는 코드입니다. TARIC 확인이 필요하며, 비교표의 한국 관세 0%가 맞지 않을 수 있습니다.", "Trade defence measures such as anti-dumping may apply to Korean goods under this code. Check TARIC. The 0% duty for Korea in the comparison may not hold.") }
        : defaultDuty(s.code, K.KOREA) === 0
          ? { level: "ok", text: L("한국산 관세 0% (EU TARIC 기준. 한-EU FTA는 원산지 요건 충족 시 적용)", "0% duty for Korean goods (EU TARIC; the EU–Korea FTA applies only if origin rules are met).") }
          : { level: "info", text: L("이 코드의 한국산 관세율 자료 없음. TARIC 확인 필요", "No duty rate data for Korean goods under this code. Check TARIC.") },
      ...(DUTY[s.code] && DUTY[s.code].q ? [{ level: "warn", text: L(`관세할당(쿼터) 초과 물량에는 추가관세 ${DUTY[s.code].q}% 부과. 비교표는 쿼터 내 물량 기준`, `Volumes above the steel tariff-rate quota carry an additional ${DUTY[s.code].q}% duty. The comparison assumes in-quota volumes.`) }] : []),
      { level: "info", text: L("바이어 신고 지원 자료: CN 코드별 물량, 원소재 밀 시트, 생산량", "To support the buyer's declaration, prepare volumes by CN code, mill certificates and production volume.") },
      ((p) => p.stale
        ? { level: "warn", text: L(`새 분기 인증서 가격이 공표됐을 수 있습니다. 현재 ${p.year}년 ${p.quarter}분기 가격 사용 중. 집행위 가격 페이지 확인 필요`, `A newer certificate price has probably been published. This tool still uses Q${p.quarter} ${p.year}. Check the Commission's price page.`) }
        : { level: "ok", text: L(`인증서 가격: ${p.year}년 ${p.quarter}분기 공표값 (자료 기준일 ${p.asOf}). 다음 분기 값은 분기 종료 후 첫 주 공표`, `The certificate price is the latest published one, Q${p.quarter} ${p.year} (data as of ${p.asOf}). The next quarter's price is published in the first week after the quarter ends.`) })(priceStatus(today)),
    ];
    return items;
  }

  return { YEARS, MARKET_PRICES, DEFAULT_RIVALS, QUESTIONS, SEGMENTS, segmentFor, RELATION, VALUE_ITEMS, VERIFICATION, DATA_ITEMS, defaultDuty, dutyFlag, marketPrice, build, regCheck, priceStatus };
});
