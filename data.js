// 공식 입력값. 기준일 2026-11-05.
// 값의 출처와 확인 수준은 04_CBAM 조사/research_notes/HS73 품목 비교/hs73_products.md 참고.
// 등급: primary 법령 원문 / official 집행위 비구속 파일·TARIC / scenario 공식값 아님
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CBAM_DATA = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    asOf: "2026-11-05",

    // 무상할당을 남겨 두는 비율(CBAM 계수). Directive 2003/87 Art.10a(1a), 등급 primary
    cbamFactor: {
      2026: 0.975, 2027: 0.95, 2028: 0.9, 2029: 0.775, 2030: 0.515,
      2031: 0.39, 2032: 0.265, 2033: 0.14, 2034: 0,
    },

    // 2026~2030 확정(Decision 2026/1862). 2031~2033 값은 잠정 가정
    cscf: { confirmedThrough: 2030, value: 1 },

    // 철강 기본값 할증. IR 2026/1740, 등급 primary
    markup: { 2026: 0.1, 2027: 0.2, 2028: 0.3 },

    // 2026 수입분 분기 인증서 가격(EUR/tCO2). 집행위 가격 페이지, 등급 official
    certificatePrice: {
      "2026Q1": 75.36,
      "2026Q2": 75.28,
      "2026Q3": 82.32,
      "2026Q4": null, // 2027-01-04 공표 예정
    },
    latestPublishedPrice: { period: "2026Q3", value: 82.32 },

    // Annex I의 HS 73 CBAM 호. 등급 primary
    coveredHs73Headings: [
      "7301", "7302", "7303", "7304", "7305", "7306", "7307",
      "7308", "7309", "7310", "7311", "7318", "7326",
    ],

    products: {
      "731815-nonstainless": {
        name: "볼트·나사 (7318 15, 스테인리스 제외)",
        cnCodes: ["73181520", "73181542", "73181548", "73181558", "73181568", "73181582", "73181588", "73181595"],
        benchmarkC: 1.364, // Column B, 경로 (C), 2026-27과 2028-30 동일. IR 2025/2620
        columnA: 0.038, // 등급 official. 실제값 경로의 공정 값
        insideEuSteelQuota: false, // 7318 전체 쿼터 밖. Reg 2026/1384 Art.12로 2027-06-30까지 재평가
        // 기본값(tCO2e/t), 경로 (C). IR 2026/1740·집행위 Excel 2026-08-06판
        defaultSee: {
          KR: 3.474, CN: 6.375, TW: 2.707, TR: 5.43, IN: 5.72,
          JP: 2.8, VN: 2.75, GB: 2.77, US: 2.58,
        },
        // 7318 15 58·82·88 등 조회한 하위코드만 확인. 나머지 코드는 사용 전 TARIC 확인
        tariff: { baseRate: 0.037, koreaFtaRate: 0, codesChecked: ["73181558", "73181582", "73181588"] },
        antiDumpingNote: {
          KR: "조회한 코드에 반덤핑 행 없음(TARIC 2026-11-04 갱신)",
          CN: "일부 코드에 잔여 86.5%, 제조사별 세율 다수. 코드별 확인 필요",
        },
      },
    },

    originNames: {
      KR: "한국", CN: "중국", TW: "대만", TR: "튀르키예", IN: "인도",
      JP: "일본", VN: "베트남", GB: "영국", US: "미국",
    },

    // 선재 전구체. 한국 7213 기본값 (C), 등급 official. 원산국 미상일 때 쓰는 Annex IV 값은 미수집
    precursors: {
      "7213": { name: "비합금 선재 (7213)", defaultSee: { KR: 2.118 }, benchmarkC: 1.364 },
    },

    // 시장 추정치이고 공식 요율이 아님. 등급 scenario
    verificationCostEstimate: { low: 5000, high: 50000, currency: "EUR", perInstallation: true },
  };
});
