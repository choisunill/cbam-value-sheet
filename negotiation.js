// 협상표 계산. 바이어 총비용(단가 + 관세 + CBAM)을 경쟁 공급처와 비교해 분담 요구에 대한 판정을 낸다.
// 바이어가 CBAM을 내고, 공급사의 분담은 단가 인하로 처리한다고 본다.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CBAM_NEGOTIATION = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function buyerTotal({ price, dutyRate, cbam }) {
    return price * (1 + dutyRate) + cbam;
  }

  // 한 경쟁 공급처와 비교. room > 0이면 우리 쪽 바이어 총비용이 그만큼 낮다.
  function compareOne(ours, rival) {
    const ourTotal = buyerTotal(ours);
    const rivalTotal = buyerTotal(rival);
    const room = rivalTotal - ourTotal;
    if (room >= 0) return { ourTotal, rivalTotal, room, verdict: "hold", needed: 0 };
    // 단가를 a 낮추면 관세도 a × 관세율만큼 준다
    const needed = -room / (1 + ours.dutyRate);
    if (needed <= ours.cbam) return { ourTotal, rivalTotal, room, verdict: "match", needed, share: needed / ours.cbam };
    return { ourTotal, rivalTotal, room, verdict: "nonprice", needed };
  }

  // 가격 조항: 공급사 분담 = min(N × P × 분담률, 상한)
  function clauseSplit({ certificates, price, share, cap }) {
    const total = certificates * price;
    const seller = Math.min(total * share, cap == null ? Infinity : cap);
    return { total, seller, buyer: total - seller, capped: cap != null && total * share > cap };
  }

  return { buyerTotal, compareOne, clauseSplit };
});
