// 협상 대응 메일 초안. 판정(가격 유지/분담 검토/가격 외 경쟁)에 맞춰 문장을 고른다. 순수 함수.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CBAM_MESSAGES = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const eur = (v) => "€" + Math.round(v).toLocaleString("en-US");
  const fmt = (c) => c.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1 $2 $3");

  // 바이어 유형(sheet.js의 세그먼트)에 따라 제안서에서 무엇을 보라고 할지가 달라진다.
  const SEG = {
    cost: { ko: "첨부한 제안서(Buyer Value Sheet)에 톤당 총조달비용을 정리해, 추측 없이 가격을 정하실 수 있게 했습니다.", en: "The attached Buyer Value Sheet shows your total landed cost per tonne, so you can price without guessing." },
    risk: { ko: "첨부한 제안서(Buyer Value Sheet)에 배출 산정 근거와 검증 상태를 정리해, CBAM 신고와 공급망 탄소 관리에 쓰실 수 있게 했습니다.", en: "The attached Buyer Value Sheet sets out the emissions basis and its verification status, for your CBAM declaration and supply chain carbon reporting." },
    certainty: { ko: "첨부한 제안서(Buyer Value Sheet)에 2028년까지 연도별 CBAM 비용을 정리해, 프로젝트 예산에 반영하실 수 있게 했습니다.", en: "The attached Buyer Value Sheet shows how the CBAM cost moves each year to 2028, so you can budget for your project." },
  };

  // s: sheet.build 결과, rival: s.comparisons 중 하나 또는 null, opt: { lang, company, buyer, clause:{on,share,cap} }
  function email(s, rival, opt) {
    const ko = opt.lang === "ko";
    const buyer = (opt.buyer || "").trim() || (ko ? "담당자" : "Sir or Madam");
    const company = (opt.company || "").trim() || (ko ? "[회사명]" : "[Company]");
    const code = fmt(s.code), cost = eur(s.current.cost), year = s.year;
    // 상황: share(CBAM 분담 요구, 기본) / reprice(가격 재협상: 조항 없이 단가로 답한다) / data(배출 자료 요청)
    const sit = opt.situation || "share";
    const cl = sit !== "reprice" && opt.clause && opt.clause.on ? opt.clause : null;
    const prod = (opt.product || "").trim();
    const label = prod ? `${prod}, CN ${code}` : `CN ${code}`;
    const share = cl ? Math.round(cl.share * 100) : 0;
    const capEn = cl && cl.cap != null ? `, capped at ${eur(cl.cap)} per tonne` : "";
    const capKo = cl && cl.cap != null ? `(톤당 ${eur(cl.cap)} 상한)` : "";
    // 가격 외 가치는 사용자가 4단계에서 고른 것만 쓴다.
    const vals = s.values || [];
    const valsKo = vals.map((v) => v.ko).join(", ");
    const valsEn = vals.map((v) => v.en[0].toLowerCase() + v.en.slice(1)).join("; ");
    const seg = SEG[s.segment] || SEG.cost;
    const lines = [];
    if (sit === "data") {
      const items = s.dataProvided || [], dv = +s.defaultValue.toFixed(3);
      if (ko) {
        lines.push(`${buyer}님께,`, "", "CBAM 자료 요청에 감사드립니다.",
          `당사 제품(${label})에 대해 드릴 수 있는 자료는 다음과 같습니다: ${items.map((d) => d.ko).join(", ") || "협의해 정하겠습니다"}.`,
          `배출 데이터 검증 상태: ${s.verification.koLong}`,
          `검증된 실제 배출값이 나오기 전에는 EU 공식 기본값(${dv} tCO2e/톤)이 적용되며, 이 기준으로 ${year}년 수입분 CBAM 비용은 톤당 ${cost}입니다.`,
          "", seg.ko, "계산 근거와 출처도 같은 제안서에 있습니다.", "", "감사합니다.", company);
        return { subject: `CN ${code} CBAM 자료 제공`, body: lines.join("\n") };
      }
      lines.push(`Dear ${buyer},`, "", "Thank you for your request for CBAM data.",
        `For our product (${label}), we can provide: ${items.map((d) => d.en[0].toLowerCase() + d.en.slice(1)).join("; ") || "to be agreed"}.`,
        `Verification status: ${s.verification.en.replace(/\.$/, "")}.`,
        `Until verified actual emissions are available, EU default values apply (${dv} tCO2e/t). On that basis, CBAM is ${cost} per tonne for ${year} imports.`,
        "", seg.en, "The calculation and sources are set out in the same sheet.", "", "Best regards,", company);
      return { subject: `CBAM data for CN ${code}`, body: lines.join("\n") };
    }

    if (ko) {
      lines.push(`${buyer}님께,`, "");
      if (sit === "reprice") lines.push("가격 검토 요청에 감사드립니다. CBAM을 포함한 총비용 기준으로 당사의 생각을 말씀드립니다.");
      else if (opt.relation === "new") lines.push("CBAM으로 공급처를 다시 검토하고 계신다면, 당사를 비교 대상에 넣어 주시기를 제안드립니다.");
      else lines.push("그동안의 거래에 감사드립니다. CBAM 비용을 어떻게 다룰지 당사의 생각을 말씀드립니다.");
      lines.push(`EU 공식 기본값으로 계산하면 당사 제품(${label})의 ${year}년 수입분 CBAM 비용은 톤당 ${cost}입니다.`);
      if (rival && rival.verdict === "hold") {
        lines.push(`CBAM을 포함해도 당사 제품의 바이어 총비용은 톤당 ${eur(rival.ourTotal)}로, ${rival.nameKo}산 대체 공급(톤당 ${eur(rival.rivalTotal)})보다 ${eur(rival.room)} 낮습니다.`);
        lines.push("그래서 현재 단가를 유지하는 것을 제안드립니다.");
        if (cl) lines.push(`비용을 더 확실히 정하고 싶으시면, 당사가 CBAM의 ${share}%를 부담하는 조항${capKo}도 함께 검토할 수 있습니다.`);
      } else if (rival && rival.verdict === "match") {
        lines.push(`귀사의 부담을 덜기 위해 단가를 톤당 ${eur(rival.needed)}(CBAM 비용의 ${Math.round(rival.share * 100)}%) 낮추는 방안을 제안드립니다.`);
        lines.push(`이렇게 하면 귀사의 총비용이 ${rival.nameKo}산 대체 공급과 같은 수준이 됩니다.`);
        if (cl) lines.push(`또는 첨부한 제안서의 조항대로 당사가 CBAM의 ${share}%를 부담하는 방식${capKo}도 가능합니다.`);
      } else if (rival && rival.verdict === "nonprice") {
        lines.push("가격이 중요하다는 점을 잘 알고 있습니다." + (valsKo ? ` 당사는 가격 외에 다음을 드립니다: ${valsKo}.` : ""));
        if (cl) lines.push(`CBAM 비용은 당사가 ${share}%를 부담하는 조항${capKo}으로 명확히 나누는 방안을 제안드립니다.`);
      } else if (cl) {
        lines.push(`CBAM 비용은 단가와 따로 두고, 당사가 ${share}%를 부담하는 조항${capKo}으로 나누는 방안을 제안드립니다.`);
      }
      if (sit === "reprice" && !rival) lines.push("대체 견적을 알려 주시면 같은 기준으로 다시 비교해 드리겠습니다.");
      lines.push("", seg.ko, "계산 근거와 출처도 같은 제안서에 있습니다.", "", "감사합니다.", company);
      return { subject: sit === "reprice" ? `CN ${code} 가격 검토 요청에 대한 회신` : `CN ${code} CBAM 비용 관련 제안`, body: lines.join("\n") };
    }

    lines.push(`Dear ${buyer},`, "");
    if (sit === "reprice") lines.push("Thank you for your request to review our price. Here is our view, based on your total cost including CBAM.");
    else if (opt.relation === "new") lines.push("If CBAM has led you to review your sources, we would like to be considered.");
    else lines.push("Thank you for your continued business. Here is how we propose to handle the CBAM cost.");
    lines.push(`Using official EU default values, CBAM on our product (${label}) is ${cost} per tonne for ${year} imports.`);
    if (rival && rival.verdict === "hold") {
      lines.push(`Even with CBAM included, your total landed cost from us is ${eur(rival.ourTotal)} per tonne, ${eur(rival.room)} lower than comparable supply from ${rival.nameEn} (${eur(rival.rivalTotal)} per tonne).`);
      lines.push("We therefore propose to keep our current price.");
      if (cl) lines.push(`If you would like more certainty, we can also agree a CBAM clause under which we bear ${share}% of the CBAM cost${capEn}.`);
    } else if (rival && rival.verdict === "match") {
      lines.push(`To support you, we can offer a price reduction of ${eur(rival.needed)} per tonne (${Math.round(rival.share * 100)}% of the CBAM cost).`);
      lines.push(`This brings your total landed cost in line with comparable supply from ${rival.nameEn}.`);
      if (cl) lines.push(`Alternatively, we can share the CBAM cost under the clause in the attached sheet: we bear ${share}%${capEn}.`);
    } else if (rival && rival.verdict === "nonprice") {
      lines.push("We understand that price matters." + (valsEn ? ` Beyond price, we offer: ${valsEn}.` : ""));
      if (cl) lines.push(`We propose to share the CBAM cost under a clear clause: we bear ${share}%${capEn}.`);
    } else if (cl) {
      lines.push(`We propose to quote CBAM separately from the unit price and share it under a clause: we bear ${share}%${capEn}.`);
    }
    if (sit === "reprice" && !rival) lines.push("If you share the alternative quote, we will compare it on the same basis.");
    lines.push("", seg.en, "The calculation and sources are set out in the same sheet.", "", "Best regards,", company);
    return { subject: sit === "reprice" ? `Your price review request: CN ${code}` : `CBAM cost for CN ${code}: our proposal`, body: lines.join("\n") };
  }

  return { email, SEG };
});
