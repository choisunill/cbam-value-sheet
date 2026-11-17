// 발표 시연용 안내: "예시 불러오기"를 누르면 단계별로 번호·제목·화살표를 띄운다.
// shortcut: 안내 문구는 한국어만. 영어 발표가 생기면 T()처럼 두 언어로 나눈다.
// 단계 문구는 guide.html(휴대폰 사용 설명서)도 같이 쓴다. m은 휴대폰용 문구(제안서가 오른쪽이 아니라 아래에 있다).
window.TOUR_STEPS = [
    { tab: "s2", targets: ["#company", "#buyer"], tags: ["우리 회사 (가상)", "바이어 (가상)"], title: "상황 설정",
      text: "한국 볼트 수출기업 한빛볼트(주)가 독일 바이어 Muster GmbH로부터 CBAM 비용을 나눠 내자는 요청을 받았습니다. (가상의 회사)" },
    { tab: "s3", targets: ["#chart"], tags: ["점선 = 한국산 총비용"], title: "원산지별 총조달비용 비교",
      text: "육각볼트 CN 7318 15 88 기준입니다. 바이어가 실제로 내는 돈 = 단가 + 관세 + CBAM. 점선이 한국산 총비용입니다." },
    { tab: "s3", targets: ["#compare .crow:nth-child(1)", "#compare .crow:nth-child(4)"], tags: ["대만 → 가격 유지", "베트남 → 가격 외 경쟁"], title: "대만은 가격 유지, 베트남은 가격 외 경쟁",
      text: "대만보다는 총비용이 낮아 가격을 지킬 수 있습니다. 베트남보다는 CBAM을 전부 떠안아도 비싸서 납기·품질·자료 지원으로 경쟁해야 합니다." },
    { tab: "s2", place: "below", targets: ['[data-q="industry"]', "#sheet"], tags: ["여기를 ‘건설·프로젝트’로 바꿔 보세요", "바뀌는 제안서 (제목·맨 위 내용)"], title: "바이어 유형을 바꾸면 제안서가 달라집니다",
      text: "업종을 ‘건설·프로젝트’로 바꿔 보세요. 오른쪽 제안서의 제목과 맨 위 내용이 가격 조항 중심으로 바뀝니다.",
      m: "2단계에서 업종을 ‘건설·프로젝트’로 바꿔 보세요. 아래 제안서의 제목과 맨 위 내용이 가격 조항 중심으로 바뀝니다." },
    { tab: "s5", place: "below", targets: ["#mailBody", "#sheet"], tags: ["바이어에게 보낼 메일 초안", "한 장짜리 제안서"], title: "Buyer Value Sheet와 협상 메일 완성",
      text: "왼쪽은 바이어의 분담 요청에 답하는 메일 초안, 오른쪽은 바이어에게 보낼 한 장짜리 제안서입니다. 6단계에서 PDF로 저장합니다.",
      m: "5단계에는 바이어의 분담 요청에 답하는 메일 초안, 그 아래에는 바이어에게 보낼 한 장짜리 제안서가 있습니다. 6단계에서 PDF로 저장합니다." },
];
(function () {
  if (!document.getElementById("demo")) return; // guide.html에서는 문구만 쓴다
  const STEPS = window.TOUR_STEPS;
  let i = -1, layer, marks, solo = false; // solo: 설명서에서 한 단계만 보러 들어온 경우(휴대폰)

  const boxOf = (sel) => { const el = document.querySelector(sel); return el && (el.closest(".field") || el); };

  function draw() {
    if (i < 0) return;
    const s = STEPS[i];
    const W = innerWidth, H = innerHeight, gap = 22, pad = 8;
    const rects = s.targets.map((sel, k) => [boxOf(sel), k]).filter(([el]) => el)
      .map(([el, k]) => { const r = el.getBoundingClientRect(); return { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad, k }; });
    // 휴대폰: 테두리와 이름표를 화면 위에 띄우지 않고 페이지에 그려 둔다. 스크롤하면 내용과 함께 움직인다.
    if (solo) {
      layer.querySelector("svg").innerHTML = "";
      marks.innerHTML = rects.map((q) => `<div class="tour-mark" style="left:${q.l + scrollX}px;top:${q.t + scrollY}px;width:${q.r - q.l}px;height:${q.b - q.t}px">${s.tags?.[q.k] ? `<span class="tour-tag">${s.tags[q.k]}</span>` : ""}</div>`).join("");
      return;
    }
    // 화면을 살짝 어둡게 하고 대상 자리만 뚫는다(evenodd). 클릭은 그대로 통과한다.
    const hole = (q) => `M${q.l + 12},${q.t}H${q.r - 12}Q${q.r},${q.t} ${q.r},${q.t + 12}V${q.b - 12}Q${q.r},${q.b} ${q.r - 12},${q.b}H${q.l + 12}Q${q.l},${q.b} ${q.l},${q.b - 12}V${q.t + 12}Q${q.l},${q.t} ${q.l + 12},${q.t}Z`;
    layer.querySelector("svg").innerHTML =
      `<path fill-rule="evenodd" fill="rgba(20,22,28,${solo ? .55 : .38})" d="M0,0H${W}V${H}H0Z ${rects.map(hole).join(" ")}"/>` +
      rects.map((q) => `<path d="${hole(q)}" fill="none" stroke="#3b9cff" stroke-width="4"/>`).join("");
    // 카드는 첫 대상의 오른쪽, 안 되면 왼쪽, 안 되면 아래. 꼬리(notch)는 대상 쪽 변에 붙인다.
    if (solo) return;
    const card = layer.querySelector(".tour-card"), cw = card.offsetWidth, ch = card.offsetHeight, q = rects[0];
    let x, y, side;
    if (!q) { x = (W - cw) / 2; y = (H - ch) / 2; side = ""; }
    else if (s.place !== "below" && q.r + gap + cw < W - 16) { x = q.r + gap; side = "left"; }
    else if (s.place !== "below" && q.l - gap - cw > 16) { x = q.l - gap - cw; side = "right"; }
    else { x = Math.min(Math.max(16, q.l), W - cw - 16); y = Math.min(q.b + gap, H - ch - 16); side = "top"; }
    const midY = q ? (Math.max(q.t, 0) + Math.min(q.b, H)) / 2 : 0;
    if (side === "left" || side === "right") y = Math.min(Math.max(16, midY - ch / 2), H - ch - 16);
    Object.assign(card.style, { left: x + "px", top: y + "px" });
    card.dataset.side = side;
    const notch = card.querySelector(".tour-notch");
    if (side === "top") notch.style.cssText = `left:${Math.min(Math.max(24, (q.l + q.r) / 2 - x), cw - 24)}px;top:-9px`;
    else if (side) notch.style.cssText = `top:${Math.min(Math.max(24, midY - y), ch - 24)}px;${side}:-9px`;
  }

  function go(n) {
    i = n;
    if (i < 0 || i >= STEPS.length) return end();
    const s = STEPS[i];
    document.querySelector(`#tabs a[href="#${s.tab}"]`).click();
    layer.querySelector(".tour-n").textContent = i + 1;
    layer.querySelector(".tour-t").textContent = s.title;
    layer.querySelector(".tour-x").textContent = solo ? s.m || s.text : s.text;
    layer.querySelector(".tour-back").href = `guide.html#g${i + 1}`;
    layer.querySelector(".tour-back").textContent = i === STEPS.length - 1 ? "← 설명서로 돌아가기" : "← 설명서";
    layer.querySelector(".tour-fwd").hidden = i === STEPS.length - 1;
    if (solo) history.replaceState(null, "", `?step=${i + 1}`); // 새로고침해도 같은 단계
    layer.querySelector(".tour-c").textContent = `${i + 1} of ${STEPS.length}`;
    layer.querySelector(".tour-prev").disabled = i === 0;
    layer.querySelector(".tour-next").textContent = i === STEPS.length - 1 ? "끝" : "다음";
    const first = boxOf(s.targets[0]);
    if (first && solo) scrollTo({ top: first.getBoundingClientRect().top + scrollY - 76 }); // 맨 위 줄(56px) 바로 아래에 대상의 윗변을 둔다
    else if (first) first.scrollIntoView({ block: "center" });
    requestAnimationFrame(draw);
  }

  function end() { i = -1; if (layer) layer.hidden = true; if (marks) marks.innerHTML = ""; document.body.classList.remove("tour-solo-on"); }

  function start(n = 0) {
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "tour";
      layer.innerHTML = `<svg aria-hidden="true"></svg>
        <div class="tour-card" role="dialog" aria-live="polite">
          <span class="tour-notch"></span>
          <button type="button" class="tour-end" aria-label="안내 닫기">✕</button>
          <span class="tour-n"></span>
          <strong class="tour-t"></strong>
          <p class="tour-x"></p>
          <div class="tour-solo"><a class="tour-back" href="guide.html">← 설명서</a><button type="button" class="tour-fwd">다음 단계 →</button></div>
          <div class="tour-nav"><span class="tour-c"></span><span><button type="button" class="tour-prev">이전</button><button type="button" class="tour-next"></button></span></div>
        </div>`;
      marks = document.createElement("div");
      marks.className = "tour-marks";
      marks.setAttribute("aria-hidden", "true");
      document.body.append(layer, marks);
      layer.querySelector(".tour-prev").addEventListener("click", () => go(i - 1));
      layer.querySelector(".tour-next").addEventListener("click", () => go(i + 1));
      layer.querySelector(".tour-end").addEventListener("click", end);
      layer.querySelector(".tour-fwd").addEventListener("click", () => go(i + 1));
      addEventListener("resize", draw);
      addEventListener("scroll", () => solo || draw(), true); // 휴대폰은 페이지에 그려 두므로 스크롤 때 다시 그릴 필요가 없다
      document.addEventListener("keydown", (e) => { if (i < 0) return; if (e.key === "Escape") end(); if (e.key === "ArrowRight") go(i + 1); if (e.key === "ArrowLeft") go(i - 1); });
      // 4단계처럼 화면에서 값을 바꾸면 대상 크기가 바뀌므로 다시 그린다
      document.getElementById("form").addEventListener("change", () => {
        // 휴대폰 4단계: 업종을 바꾸면 아래 제안서로 내려가 바뀐 모습을 보여 준다
        const sheet = document.getElementById("sheet");
        if (solo && i >= 0 && STEPS[i].targets.includes("#sheet")) setTimeout(() => scrollTo({ top: sheet.getBoundingClientRect().top + scrollY - 76, behavior: "smooth" }), 300);
        requestAnimationFrame(draw);
      });
    }
    layer.hidden = false;
    layer.classList.toggle("solo", solo);
    document.body.classList.toggle("tour-solo-on", solo);
    go(n);
  }

  // app.js의 예시 채우기가 먼저 실행된 뒤 안내를 띄운다
  // 휴대폰은 화면을 가리는 카드 대신 사용 설명서 페이지를 연다(예시 값은 저장돼 있어 돌아오면 그대로다)
  document.getElementById("demo").addEventListener("click", () => setTimeout(() => (solo ? null : matchMedia("(max-width: 760px)").matches ? (location.href = "guide.html") : start()), 0));

  // 설명서에서 단계를 누르면 index.html?step=N 으로 온다. 그 단계만 강조하고 "설명서로 돌아가기"를 보여 준다.
  const n = Number(new URLSearchParams(location.search).get("step"));
  if (n >= 1 && n <= STEPS.length) {
    solo = true;
    if (!document.getElementById("company").value) document.getElementById("demo").click(); // QR로 바로 온 경우 예시부터 채운다
    setTimeout(() => start(n - 1), 0);
  }
})();
