// CBAM 톤당 비용 계산 엔진. 화면과 분리된 순수 함수.
// 식: N = max(0, SEE - F × CSCF × BM - R), 비용 = N × P
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"));
  else root.CBAM_ENGINE = factory(root.CBAM_DATA);
})(typeof globalThis !== "undefined" ? globalThis : this, function (DATA) {
  function positive(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(name + " 값이 올바르지 않습니다: " + value);
    }
    return value;
  }

  function factorFor(year) {
    if (year < 2026) throw new Error("2026년 이전 수입분은 확정 단계가 아닙니다: " + year);
    return year >= 2034 ? 0 : DATA.cbamFactor[year];
  }

  function markupFor(year) {
    return year >= 2028 ? DATA.markup[2028] : DATA.markup[year];
  }

  // 인증서 N장을 구하는 핵심 식. 0 아래로 내려가지 않는다.
  function certificates({ see, benchmark, year, deduction = 0 }) {
    positive(see, "SEE");
    positive(benchmark, "벤치마크");
    positive(deduction, "원산국 공제");
    const free = factorFor(year) * DATA.cscf.value * benchmark;
    return { n: Math.max(0, see - free - deduction), free, floored: see - free - deduction < 0 };
  }

  // 2026은 분기 공표값, 그 뒤와 미공표 분기는 사용자 시나리오 또는 최신 공표값을 쓰고 상태를 표시한다.
  function resolvePrice({ year, quarter, scenarioPrice }) {
    if (scenarioPrice !== undefined && scenarioPrice !== null) {
      return { value: positive(scenarioPrice, "시나리오 가격"), status: "scenario", label: "사용자 시나리오 가격" };
    }
    const published = year === 2026 && quarter ? DATA.certificatePrice["2026Q" + quarter] : null;
    if (published) return { value: published, status: "published", label: "공표 가격 2026년 " + quarter + "분기" };
    const latest = DATA.latestPublishedPrice;
    return {
      value: latest.value,
      status: "assumed",
      label: "최신 공표 가격(" + latest.period + ")을 그대로 쓴 가정이며 전망이 아님",
    };
  }

  function productOf(productId) {
    const product = DATA.products[productId];
    if (!product) throw new Error("지원하지 않는 품목입니다: " + productId);
    return product;
  }

  function yearNotes(year) {
    const notes = [];
    if (year >= 2027) notes.push("2027-01-01 적용 예정 개정 벤치마크를 찾지 못해 현행 값을 썼습니다.");
    if (year > DATA.cscf.confirmedThrough) notes.push("이 연도의 교차업종 보정계수는 잠정 가정입니다.");
    return notes;
  }

  // 공통 결과 형식
  function result({ see, benchmark, year, quarter, scenarioPrice, deduction, basis, notes }) {
    const { n, free, floored } = certificates({ see, benchmark, year, deduction });
    const price = resolvePrice({ year, quarter, scenarioPrice });
    const allNotes = [...yearNotes(year), ...(notes || [])];
    if (floored) allNotes.push("공제선 아래라 인증서가 0장입니다. 더 줄여도 이 해의 비용은 줄지 않습니다.");
    return { basis, year, see, benchmark, freeAllocation: free, certificatesPerTonne: n, price, costPerTonne: n * price.value, notes: allNotes };
  }

  // 1. 기본값 경로
  function defaultCost({ productId, origin, year, quarter, scenarioPrice }) {
    const product = productOf(productId);
    const base = product.defaultSee[origin];
    if (base === undefined) throw new Error("이 원산국의 기본값이 없습니다: " + origin);
    const markup = markupFor(year);
    const out = result({ see: base * (1 + markup), benchmark: product.benchmarkC, year, quarter, scenarioPrice, basis: "default" });
    return { ...out, origin, defaultSee: base, markup };
  }

  // 2. 공정 실제값 + 선재 기본값. 선재 기본값의 할증 적용 여부는 조문이 명확하지 않아 선택으로 둔다.
  function mixedCost({ productId, processEmissions, inputPerOutput, precursorId = "7213", precursorOrigin = "KR", applyMarkupToPrecursor = true, year, quarter, scenarioPrice }) {
    const product = productOf(productId);
    const precursor = DATA.precursors[precursorId];
    if (!precursor) throw new Error("지원하지 않는 전구체입니다: " + precursorId);
    const base = precursor.defaultSee[precursorOrigin];
    if (base === undefined) {
      throw new Error("선재 원산국의 기본값이 없습니다. 원산국을 모르면 더 높은 기본값이 적용될 수 있습니다: " + precursorOrigin);
    }
    positive(processEmissions, "공정 배출량");
    positive(inputPerOutput, "투입 톤/산출 톤");
    const precursorSee = applyMarkupToPrecursor ? base * (1 + markupFor(year)) : base;
    const benchmark = product.columnA + inputPerOutput * precursor.benchmarkC;
    return result({
      see: processEmissions + inputPerOutput * precursorSee,
      benchmark, year, quarter, scenarioPrice, basis: "mixed",
      notes: ["자기 공정의 검증보고서가 있어야 쓸 수 있는 경로입니다. 첫 보고서는 2027년 1월부터 가능합니다."],
    });
  }

  // 3. 전 과정 실제값. 검증보고서의 SEE와 공제 기준값을 그대로 받는다.
  function actualCost({ see, benchmark, deduction = 0, verified = false, year, quarter, scenarioPrice }) {
    const notes = [verified ? "검증보고서 값입니다." : "검증보고서 미발급 값입니다. 2026년 수입분도 2027년 초 이후 보고서로 쓸 수 있습니다."];
    return { ...result({ see, benchmark, deduction, year, quarter, scenarioPrice, basis: "actual", notes }), verified };
  }

  // 대상 확인. 지원 품목이 아니어도 CBAM 대상 여부는 알려 준다.
  function checkCoverage(cnCode) {
    const code = String(cnCode).replace(/\D/g, "");
    if (code.length < 4) return { status: "invalid", message: "CN 코드를 4자리 이상 입력해 주세요." };
    if (!code.startsWith("73")) return { status: "unknown", message: "이 도구는 아직 HS 73류만 판정합니다." };
    const covered = DATA.coveredHs73Headings.includes(code.slice(0, 4));
    if (!covered) return { status: "not_covered", message: "현행 Annex I의 HS 73 CBAM 호에 없습니다." };
    const productId = Object.keys(DATA.products).find((id) => DATA.products[id].cnCodes.includes(code)) || null;
    return {
      status: productId ? "supported" : "covered_unsupported",
      productId,
      message: productId ? "CBAM 대상이고 계산을 지원합니다." : "CBAM 대상이지만 이 코드의 비용 계산은 아직 지원하지 않습니다.",
    };
  }

  // 전체 금액. 물량이 50톤 이하일 때는 수입자 연간 합산 기준을 안내한다.
  function totalCost(perTonne, quantity) {
    positive(quantity, "수출량");
    const notes = [];
    if (quantity <= 50) notes.push("수입자의 연간 CBAM 품목 합산이 50톤 이하면 면제될 수 있습니다. 이 물량만으로 판단할 수 없습니다.");
    return { quantity, total: perTonne * quantity, notes };
  }

  // 바이어 총비용. 호가에 CBAM이 포함됐는지 모르면 합계를 내지 않는다(이중 계산 방지).
  function buyerCost({ price, priceIncludesCbam, cbamPerTonne, dutyRate = 0, antiDumpingRate = 0 }) {
    positive(price, "판매 가격");
    positive(cbamPerTonne, "CBAM 비용");
    const duty = price * (dutyRate + antiDumpingRate);
    if (priceIncludesCbam === undefined || priceIncludesCbam === null) {
      return { total: null, duty, reason: "호가에 CBAM이 포함됐는지 확인해야 합계를 낼 수 있습니다." };
    }
    return { total: price + duty + (priceIncludesCbam ? 0 : cbamPerTonne), duty, includedCbam: priceIncludesCbam };
  }

  // 검증 비용을 회수하는 물량. 절감이 없으면 null.
  function paybackTonnes({ verificationCost, savingPerTonne, passThrough = 1 }) {
    positive(verificationCost, "검증 비용");
    const value = savingPerTonne * positive(passThrough, "전가 비율");
    return value > 0 ? verificationCost / value : null;
  }

  // 기본값끼리의 경쟁국 비교. 싼 순서로 정렬하고 한국이 불리해도 그대로 돌려준다.
  function compareDefaults({ productId, origins, year, quarter, scenarioPrice }) {
    const product = productOf(productId);
    const list = origins || Object.keys(product.defaultSee);
    return {
      basis: "default_vs_default",
      caveat: "공식 기본값 비교입니다. 각 나라 기업의 실제 배출량이 아니며, 실제값을 신고하면 달라집니다.",
      rows: list
        .map((origin) => {
          const r = defaultCost({ productId, origin, year, quarter, scenarioPrice });
          return { origin, name: DATA.originNames[origin] || origin, defaultSee: r.defaultSee, certificatesPerTonne: r.certificatesPerTonne, costPerTonne: r.costPerTonne };
        })
        .sort((a, b) => a.costPerTonne - b.costPerTonne),
    };
  }

  return { certificates, resolvePrice, defaultCost, mixedCost, actualCost, checkCoverage, totalCost, buyerCost, paybackTonnes, compareDefaults };
});
