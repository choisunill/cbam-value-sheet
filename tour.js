// 발표 시연용 안내: "예시 불러오기"를 누르면 단계별로 번호·제목·화살표를 띄운다.
// shortcut: 안내 문구는 한국어만. 영어 발표가 생기면 T()처럼 두 언어로 나눈다.
(function () {
  const STEPS = [
    { tab: "s2", targets: ["#company", "#buyer"], title: "상황 설정",
      text: "한국 볼트 수출기업 한빛볼트(주)가 독일 바이어 Muster GmbH로부터 CBAM 비용을 나눠 내자는 요청을 받았습니다. (가상의 회사)" },
    { tab: "s3", targets: ["#chart"], title: "원산지별 총조달비용 비교",
      text: "육각볼트 CN 7318 15 88 기준입니다. 바이어가 실제로 내는 돈 = 단가 + 관세 + CBAM. 점선이 한국산 총비용입니다." },
    { tab: "s3", targets: ["#compare .crow:nth-child(1)", "#compare .crow:nth-child(4)"], title: "대만은 가격 유지, 베트남은 가격 외 경쟁",
      text: "대만보다는 총비용이 낮아 가격을 지킬 수 있습니다. 베트남보다는 CBAM을 전부 떠안아도 비싸서 납기·품질·자료 지원으로 경쟁해야 합니다." },
    { tab: "s2", place: "below", targets: ['[data-q="industry"]', "#sheet"], title: "바이어 유형을 바꾸면 제안서가 달라집니다",
      text: "업종을 ‘건설·프로젝트’로 바꿔 보세요. 오른쪽 제안서의 제목과 맨 위 내용이 가격 조항 중심으로 바뀝니다." },
    { tab: "s5", place: "below", targets: ["#mailBody", "#sheet"], title: "Buyer Value Sheet와 협상 메일 완성",
      text: "왼쪽은 바이어의 분담 요청에 답하는 메일 초안, 오른쪽은 바이어에게 보낼 한 장짜리 제안서입니다. 6단계에서 PDF로 저장합니다." },
  ];
  let i = -1, layer;

  const boxOf = (sel) => { const el = document.querySelector(sel); return el && (el.closest(".field") || el); };

  function draw() {
    if (i < 0) return;
    const s = STEPS[i];
    const els = s.targets.map(boxOf).filter(Boolean);
    const W = innerWidth, H = innerHeight, gap = 90;
    const rects = els.map((el) => el.getBoundingClientRect());
    layer.querySelectorAll(".tour-hl").forEach((n) => n.remove());
    rects.forEach((r) => {
      const hl = document.createElement("div");
      hl.className = "tour-hl";
      Object.assign(hl.style, { left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
      layer.prepend(hl);
    });
    // 카드는 첫 대상의 오른쪽, 자리가 없으면 왼쪽, 그것도 없으면 화면 아래 가운데
    const card = layer.querySelector(".tour-card"), cw = card.offsetWidth, ch = card.offsetHeight, r0 = rects[0];
    let x, y;
    if (r0 && r0.right + gap + cw < W - 16) x = r0.right + gap;
    else if (r0 && r0.left - gap - cw > 16) x = r0.left - gap - cw;
    else x = (W - cw) / 2;
    y = r0 ? Math.min(Math.max(16, r0.top + Math.min(r0.height, H) / 2 - ch / 2), H - ch - 16) : (H - ch) / 2;
    if (r0 && x === (W - cw) / 2) y = H - ch - 16;
    // 오른쪽 제안서가 바뀌는 걸 봐야 하는 단계는 카드를 대상 아래에 둔다
    if (r0 && s.place === "below") { x = Math.max(16, r0.left); y = Math.min(r0.bottom + 70, H - ch - 16); }
    Object.assign(card.style, { left: x + "px", top: y + "px" });
    // 화살표: 카드 가장자리에서 각 대상의 가장 가까운 점으로
    const cx = x + cw / 2, cy = y + ch / 2;
    layer.querySelector("svg").innerHTML = `<defs><marker id="tour-head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff5a1f"/></marker></defs>` +
      rects.map((r) => {
        const tx = Math.min(Math.max(cx, r.left - 8), r.right + 8), ty = Math.min(Math.max(cy, Math.max(r.top, 0) - 8), Math.min(r.bottom, H) + 8);
        const sx = Math.min(Math.max(tx, x), x + cw), sy = Math.min(Math.max(ty, y), y + ch);
        return `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#ff5a1f" stroke-width="5" stroke-linecap="round" marker-end="url(#tour-head)"/>`;
      }).join("");
  }

  function go(n) {
    i = n;
    if (i < 0 || i >= STEPS.length) return end();
    const s = STEPS[i];
    document.querySelector(`#tabs a[href="#${s.tab}"]`).click();
    layer.querySelector(".tour-n").textContent = i + 1;
    layer.querySelector(".tour-t").textContent = s.title;
    layer.querySelector(".tour-x").textContent = s.text;
    layer.querySelector(".tour-c").textContent = `${i + 1} / ${STEPS.length}`;
    layer.querySelector(".tour-prev").disabled = i === 0;
    layer.querySelector(".tour-next").textContent = i === STEPS.length - 1 ? "끝" : "다음 →";
    const first = boxOf(s.targets[0]);
    if (first) first.scrollIntoView({ block: "center" });
    requestAnimationFrame(draw);
  }

  function end() { i = -1; if (layer) layer.hidden = true; }

  function start() {
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "tour";
      layer.innerHTML = `<svg aria-hidden="true"></svg>
        <div class="tour-card" role="dialog" aria-live="polite">
          <div class="tour-head"><span class="tour-n"></span><strong class="tour-t"></strong></div>
          <p class="tour-x"></p>
          <div class="tour-nav"><span class="tour-c"></span><span><button type="button" class="btn tour-end">닫기</button> <button type="button" class="btn tour-prev">← 이전</button> <button type="button" class="btn primary tour-next"></button></span></div>
        </div>`;
      document.body.append(layer);
      layer.querySelector(".tour-prev").addEventListener("click", () => go(i - 1));
      layer.querySelector(".tour-next").addEventListener("click", () => go(i + 1));
      layer.querySelector(".tour-end").addEventListener("click", end);
      addEventListener("resize", draw);
      addEventListener("scroll", draw, true);
      document.addEventListener("keydown", (e) => { if (i < 0) return; if (e.key === "Escape") end(); if (e.key === "ArrowRight") go(i + 1); if (e.key === "ArrowLeft") go(i - 1); });
      // 4단계처럼 화면에서 값을 바꾸면 대상 크기가 바뀌므로 다시 그린다
      document.getElementById("form").addEventListener("change", () => requestAnimationFrame(draw));
    }
    layer.hidden = false;
    go(0);
  }

  // app.js의 예시 채우기가 먼저 실행된 뒤 안내를 띄운다
  document.getElementById("demo").addEventListener("click", () => setTimeout(start, 0));
})();
