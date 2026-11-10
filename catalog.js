// 철강·알루미늄 전 CN 코드의 기본값 비용. 계산식은 engine.js의 certificates/resolvePrice를 그대로 쓴다.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./catalog-data.js"), require("./engine.js"));
  else root.CBAM_CATALOG = factory(root.CBAM_CATALOG_DATA, root.CBAM_ENGINE);
})(typeof globalThis !== "undefined" ? globalThis : this, function (C, E) {
  const KOREA = "Korea, Republic of (South Korea)";
  const NOT_ORIGINS = ["Mean of 10 highest", "Other Countries and Territories"];
  const KO = {
    China: "중국", Taiwan: "대만", India: "인도", "Türkiye": "튀르키예", "Viet Nam": "베트남", Japan: "일본",
    Indonesia: "인도네시아", Malaysia: "말레이시아", Thailand: "태국", "United States": "미국", "United Kingdom": "영국",
    Ukraine: "우크라이나", Brazil: "브라질", Egypt: "이집트", "South Africa": "남아공", "Russian Federation": "러시아",
    "United Arab Emirates": "아랍에미리트", Mexico: "멕시코", Canada: "캐나다", Serbia: "세르비아", Kazakhstan: "카자흐스탄",
    "Saudi Arabia": "사우디아라비아", Philippines: "필리핀", Pakistan: "파키스탄", Australia: "호주",
  };
  const EN = { "Viet Nam": "Vietnam", "Korea, Republic of (South Korea)": "Korea" };
  const MARKUP = { 2026: 0.1, 2027: 0.2, 2028: 0.3 };

  const nameKo = (c) => KO[c] || c;
  const nameEn = (c) => EN[c] || c;
  const origins = () => C.countries.filter((c) => c !== KOREA && !NOT_ORIGINS.includes(c));

  // 8자리 코드에 해당하는 기본값 행: 가장 긴 앞자리 일치(8 → 6 → 4)
  function dvFor(country, cn) {
    const t = C.dv[country];
    if (!t) return null;
    for (const len of [8, 6, 4]) {
      const key = cn.slice(0, len);
      if (t[key]) return { code: key, total: t[key][0], route: t[key][1] };
    }
    return null;
  }

  // Column B 중 기본값 경로·연도 기간에 맞는 한 줄을 고른다. 하나로 정해지지 않으면 null.
  function benchmarkFor(cn, route, year) {
    const rows = C.bm[cn];
    if (!rows || !rows.length) return null;
    if (rows.length === 1 && !rows[0][1]) return rows[0][0];
    const period = year <= 2027 ? "(1)" : "(2)";
    const hasPeriod = (ind) => /\([12]\)/.test(ind || "");
    const hits = rows.filter(([, ind]) => {
      if (hasPeriod(ind) && !ind.includes(period)) return false;
      const letter = (ind || "").replace(/\([12]\)/g, "");
      return route ? letter === route : letter === "";
    });
    return hits.length === 1 ? hits[0][0] : null;
  }

  function codes() {
    return Object.keys(C.bm).map((cn) => ({ cn, sector: C.bmSector[cn], desc: C.bmDesc[cn] }));
  }

  // 한 원산지·코드·연도의 기본값 비용. 계산할 수 없으면 reason을 돌려준다.
  function cost({ cn, origin = KOREA, year, quarter, scenarioPrice }) {
    if (!C.bm[cn]) return { ok: false, reason: "CBAM 철강·알루미늄 코드가 아닙니다." };
    const d = dvFor(origin, cn);
    if (!d) return { ok: false, reason: "이 원산지의 공식 기본값이 없습니다." };
    if (d.route && d.route.includes("/")) return { ok: false, reason: "생산경로가 둘(" + d.route + ")로 표시돼 벤치마크를 하나로 정할 수 없습니다." };
    const benchmark = benchmarkFor(cn, d.route, year);
    if (benchmark == null) return { ok: false, reason: "이 코드의 벤치마크를 하나로 정할 수 없습니다." };
    const see = d.total * (1 + (year >= 2028 ? MARKUP[2028] : MARKUP[year]));
    const { n } = E.certificates({ see, benchmark, year });
    const price = E.resolvePrice({ year, quarter, scenarioPrice });
    return { ok: true, cn, origin, year, defaultValue: d.total, dvCode: d.code, route: d.route, benchmark, see, certificates: n, price, costPerTonne: n * price.value };
  }

  return { KOREA, MARKUP, origins, nameKo, nameEn, dvFor, benchmarkFor, codes, cost, source: C.source };
});
