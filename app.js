// 화면 연결. 계산은 sheet.js / catalog.js / engine.js가 하고, 여기서는 입력을 모으고 그린다.
(function () {
  const S = window.CBAM_SHEET, K = window.CBAM_CATALOG;
  const $ = (id) => document.getElementById(id);
  const KEY = "cbam-value-sheet-v3";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur = (v, d = 0) => "€" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtCode = (c) => c.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1 $2 $3");
  const ALL = K.codes();
  const BY_CODE = Object.fromEntries(ALL.map((c) => [c.cn, c]));
  const num = (v) => (v === "" || v == null ? NaN : Number(v));

  function rivalFor(code, origin) {
    const price = S.marketPrice(code, origin), duty = S.defaultDuty(code, origin);
    return { origin, price: price ?? NaN, duty: duty ?? NaN, include: null };
  }
  function freshState() {
    const code = S.MARKET_PRICES.code;
    return {
      code, year: 2026, qty: 100, ourPrice: S.marketPrice(code, K.KOREA) ?? NaN,
      rivals: S.DEFAULT_RIVALS.map((o) => rivalFor(code, o)),
      company: "", buyer: "", buyerProfile: { relation: "existing", industry: "distributor", purpose: "resale", exposure: "unknown", esg: false }, roles: true,
      values: { relationship: false, lead: false, supply: false, quality: false, support: true },
      dataItems: { cn: true, mill: true, volume: true, installation: false },
      verification: "none", clause: { on: true, share: 0.5, cap: 120 }, lang: "ko",
    };
  }

  let state;
  try { state = { ...freshState(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { state = freshState(); }
  if (!BY_CODE[state.code]) state = freshState();
  state.rivals.forEach((r) => { r.price = num(r.price); r.duty = num(r.duty); }); // JSON에서 NaN이 null로 돌아온다
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 못 해도 계산은 된다 */ } };

  // ---------- 입력 화면 만들기 ----------
  const sectorKo = { steel: "철강", aluminium: "알루미늄" };
  // CN 코드 선택: 4자리 → 2자리 → 2자리. 앞 칸을 바꾸면 뒤 칸 목록이 바뀐다. 품명은 아래 한 줄로.
  const uniq = (arr) => [...new Set(arr)];
  function fillH4() {
    $("h4").innerHTML = ["steel", "aluminium"].map((sec) =>
      `<optgroup label="${sectorKo[sec]}">${uniq(ALL.filter((c) => c.sector === sec).map((c) => c.cn.slice(0, 4))).map((h) => `<option value="${h}">${h}</option>`).join("")}</optgroup>`).join("");
  }
  function fillH6(h4) {
    $("h6").innerHTML = uniq(ALL.filter((c) => c.cn.startsWith(h4)).map((c) => c.cn.slice(0, 6))).map((h) => `<option value="${h}">${h.slice(4)}</option>`).join("");
  }
  function fillCn8(h6) {
    $("cn8").innerHTML = ALL.filter((c) => c.cn.startsWith(h6)).map((c) => `<option value="${c.cn}">${c.cn.slice(6)}</option>`).join("");
  }
  function showCode(cn) {
    fillH4(); $("h4").value = cn.slice(0, 4);
    fillH6(cn.slice(0, 4)); $("h6").value = cn.slice(0, 6);
    fillCn8(cn.slice(0, 6)); $("cn8").value = cn;
  }
  fillH4();
  $("year").innerHTML = S.YEARS.map((y) => `<button type="button" role="radio" data-y="${y}">${y}</button>`).join("");
  // 바이어 진단(STP) 질문
  $("buyerProfile").innerHTML = `<div class="qgrid"><label class="field" style="margin:0"><span>이 바이어와의 관계 (수정 재구매 상황)</span><select data-q="relation">${Object.entries(S.RELATION).map(([v, t]) => `<option value="${v}">${esc(t.label)}</option>`).join("")}</select></label>${Object.entries(S.QUESTIONS).map(([k, q]) =>
    `<label class="field" style="margin:0"><span>${esc(q.ko)}</span><select data-q="${k}">${Object.entries(q.options).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select></label>`).join("")}
    <label class="check" style="margin:0"><input type="checkbox" data-q="esg"> 공급망 탄소(Scope 3)를 공시하거나 관리함</label></div>`;
  $("valueItems").innerHTML = "<span>가격 외에 드리는 가치 (사실인 것만 고르세요)</span>" + Object.entries(S.VALUE_ITEMS).map(([k, v]) =>
    `<label class="check"><input type="checkbox" data-k="${k}"> ${esc(v.ko)}</label>`).join("");
  $("dataItems").innerHTML = "<span>제안서에 적을 제공 자료</span>" + Object.entries(S.DATA_ITEMS).map(([k, v]) =>
    `<label class="check"><input type="checkbox" data-k="${k}"> ${esc(v.ko)}</label>`).join("");
  $("verification").innerHTML = Object.entries(S.VERIFICATION).map(([k, v]) => `<option value="${k}">${esc(v.ko)}</option>`).join("");

  function renderAddRival() {
    const used = new Set(state.rivals.map((r) => r.origin));
    const opts = K.origins().filter((o) => !used.has(o)).sort((a, b) => K.nameKo(a).localeCompare(K.nameKo(b), "ko"));
    $("addRival").innerHTML = `<option value="">+ 경쟁국 추가 (${opts.length}개국 기본값 보유)</option>` +
      opts.map((o) => `<option value="${esc(o)}">${esc(K.nameKo(o))}${K.nameKo(o) !== o ? " · " + esc(o) : ""}</option>`).join("");
  }

  function syncInputs() {
    showCode(state.code);
    $("qty").value = Number.isFinite(state.qty) ? state.qty : "";
    $("company").value = state.company;
    $("buyer").value = state.buyer;
    $("ourPrice").value = Number.isFinite(state.ourPrice) ? state.ourPrice : "";
    $("clauseOn").checked = state.clause.on;
    $("share").value = Math.round(state.clause.share * 100);
    $("cap").value = state.clause.cap == null ? "" : state.clause.cap;
    $("verification").value = state.verification;
    document.querySelectorAll("#dataItems input").forEach((el) => (el.checked = !!state.dataItems[el.dataset.k]));
    if (!state.values) state.values = {};
    if (!state.buyerProfile.relation) state.buyerProfile.relation = "existing";
    document.querySelectorAll("#valueItems input").forEach((el) => (el.checked = !!state.values[el.dataset.k]));
    document.querySelectorAll("#buyerProfile [data-q]").forEach((el) => {
      if (el.type === "checkbox") el.checked = !!state.buyerProfile[el.dataset.q]; else el.value = state.buyerProfile[el.dataset.q];
    });
    $("rolesOn").checked = state.roles !== false;
    renderAddRival();
  }

  // ---------- 이벤트 ----------
  // 앞 단계를 바꾸면 뒤 단계는 첫 항목으로 맞춘다.
  // 앞 칸을 바꾸면 그 안에서 한국산 시장 단가가 있는 첫 코드를 고른다(없으면 첫 코드).
  const bestIn = (prefix) => { const list = ALL.filter((c) => c.cn.startsWith(prefix)); return (list.find((c) => S.marketPrice(c.cn, K.KOREA) != null) || list[0]).cn; };
  $("h4").addEventListener("change", (e) => setCode(bestIn(e.target.value)));
  $("h6").addEventListener("change", (e) => setCode(bestIn(e.target.value)));
  $("cn8").addEventListener("change", (e) => setCode(e.target.value));
  function setCode(cn) {
    if (!BY_CODE[cn] || cn === state.code) return;
    state.code = cn;
    state.rivals = state.rivals.map((r) => rivalFor(cn, r.origin));
    state.ourPrice = S.marketPrice(cn, K.KOREA) ?? NaN;
    syncInputs(); render();
  }
  $("year").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { state.year = Number(b.dataset.y); render(); } });
  $("buyerProfile").addEventListener("change", (e) => {
    const k = e.target.dataset.q;
    if (!k) return;
    state.buyerProfile[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    render();
  });
  $("rolesOn").addEventListener("change", (e) => { state.roles = e.target.checked; render(false); });
  $("valueItems").addEventListener("change", (e) => { if (e.target.dataset.k) { state.values[e.target.dataset.k] = e.target.checked; render(false); } });
  $("mailRival").addEventListener("change", (e) => { state.mailRival = e.target.value; renderMail(lastSheet); });
  $("mailCopy").addEventListener("click", async () => {
    const text = $("mailSubject").value + "\n\n" + $("mailBody").value;
    try { await navigator.clipboard.writeText(text); $("mailCopied").textContent = "복사했어요"; }
    catch { $("mailBody").select(); $("mailCopied").textContent = "Ctrl+C로 복사하세요"; }
  });
  [["qty", "qty"], ["ourPrice", "ourPrice"]].forEach(([id, k]) => $(id).addEventListener("input", (e) => { state[k] = num(e.target.value); render(); }));
  [["company", "company"], ["buyer", "buyer"]].forEach(([id, k]) => $(id).addEventListener("input", (e) => { state[k] = e.target.value; render(); }));
  $("clauseOn").addEventListener("change", (e) => { state.clause.on = e.target.checked; render(); });
  $("share").addEventListener("input", (e) => { state.clause.share = Number(e.target.value) / 100; render(); });
  $("cap").addEventListener("input", (e) => { const v = num(e.target.value); state.clause.cap = Number.isFinite(v) ? v : null; render(); });
  $("verification").addEventListener("change", (e) => { state.verification = e.target.value; render(); });
  $("dataItems").addEventListener("change", (e) => { if (e.target.dataset.k) { state.dataItems[e.target.dataset.k] = e.target.checked; render(); } });
  $("addRival").addEventListener("change", (e) => {
    if (!e.target.value) return;
    state.rivals.push(rivalFor(state.code, e.target.value));
    renderAddRival(); render();
  });
  $("compare").addEventListener("click", (e) => {
    const b = e.target.closest(".remove");
    if (!b) return;
    state.rivals.splice(Number(b.dataset.i), 1);
    renderAddRival(); render();
  });
  $("compare").addEventListener("input", (e) => {
    const el = e.target, r = state.rivals[el.dataset.i];
    if (!r) return;
    if (el.dataset.k === "include") r.include = el.checked;
    else r[el.dataset.k] = num(el.value);
    render(false);
  });
  $("print").addEventListener("click", () => window.print());
  // 시연용 예시: 가상의 회사와 바이어로 모든 칸을 채우고 1단계로 돌아간다. 입력해 둔 값은 지워진다.
  $("demo").addEventListener("click", () => {
    state = {
      ...freshState(), lang: state.lang,
      company: "한빛볼트(주)", buyer: "Muster GmbH",
      buyerProfile: { relation: "existing", industry: "distributor", purpose: "resale", exposure: "high", esg: false },
      values: { relationship: true, lead: true, supply: false, quality: true, support: true },
      verification: "self",
    };
    syncInputs(); render();
    document.querySelector("#tabs a").click();
  });
  $("lang").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { state.lang = b.dataset.l; render(false); } });

  // ---------- 그리기 ----------
  function renderCompare(s) {
    const rows = s.ok ? s.rivals : [];
    $("compare").innerHTML = rows.map((r, i) => {
      let verdict = r.cbam == null ? `<span class="hint">${esc(r.cbamReason)}</span>` : `<span class="hint">단가와 관세율을 넣으면 판정이 나와요</span>`;
      if (r.verdict === "hold") verdict = `<span class="tag hold">가격 유지</span> 우리가 ${eur(r.room)} 낮음`;
      if (r.verdict === "match") verdict = `<span class="tag match">분담 검토</span> 단가 ${eur(r.needed)} 인하 시 동일 (CBAM의 ${Math.round(r.share * 100)}%)`;
      if (r.verdict === "nonprice") verdict = `<span class="tag nonprice">가격 외 경쟁</span> CBAM을 다 양보해도 ${eur(-r.room)} 높음`;
      return `<div class="crow">
        <div class="top"><strong>${esc(r.nameKo)}산과 비교</strong>
          <span><label class="check" style="margin:0;display:inline-flex"><input type="checkbox" data-i="${i}" data-k="include" ${r.include ? "checked" : ""} ${r.verdict ? "" : "disabled"}> 제안서에 넣기</label>
          <button type="button" class="remove" data-i="${i}" aria-label="${esc(r.nameKo)} 빼기">✕</button></span></div>
        <div class="cbam">${r.cbam != null ? `CBAM ${eur(r.cbam)}/t · 공식 기본값 ${+r.defaultValue.toFixed(3)} tCO2e/t` : ""}${S.dutyFlag(state.code, r.origin) ? " · 반덤핑·상계관세 등이 걸려 있어요. 관세율을 TARIC에서 확인해 넣어 주세요." : ""}</div>
        <div class="inputs">
          <input type="number" min="0" step="1" data-i="${i}" data-k="price" value="${Number.isFinite(r.price) ? r.price : ""}" placeholder="단가 €/t" aria-label="${esc(r.nameKo)} 단가">
          <input type="number" min="0" step="0.1" data-i="${i}" data-k="duty" value="${Number.isFinite(r.duty) ? r.duty : ""}" placeholder="관세 %" aria-label="${esc(r.nameKo)} 관세율 %">
        </div>
        <div class="verdict">${verdict}</div></div>`;
    }).join("");
  }

  // 가격 비교 그래프: 바이어 총비용(단가 + 관세 + CBAM)을 원산지별 가로 막대로. 점선이 우리 총비용.
  function renderChart(s) {
    const el = $("chart");
    if (!s.ok || !(state.ourPrice > 0)) { el.innerHTML = `<p class="hint">우리 단가를 넣으면 그래프가 나와요.</p>`; return; }
    const rows = [{ name: "한국 (우리)", price: state.ourPrice, duty: 0, cbam: s.current.cost, ours: true },
      ...s.comparisons.map((c) => ({ name: c.nameKo, price: c.price, duty: c.price * c.duty / 100, cbam: c.cbam, c }))];
    rows.forEach((r) => (r.total = r.price + r.duty + r.cbam));
    rows.sort((a, b) => a.total - b.total);
    const ourTotal = rows.find((r) => r.ours).total;
    const cap = ourTotal * 2; // 이보다 큰 막대는 잘라서 그린다(값은 숫자로 표시)
    const scale = Math.min(Math.max(...rows.map((r) => r.total)), cap) * 1.04;
    const lower = s.comparisons.filter((c) => c.verdict === "hold").length;
    const note = (r) => {
      if (r.ours) return "기준";
      const c = r.c;
      if (c.verdict === "hold") return `<span class="tag hold">가격 유지</span>우리가 ${eur(c.room)} 낮음`;
      if (c.verdict === "match") return `<span class="tag match">분담 검토</span>${eur(c.needed)} 인하 시 동일`;
      return `<span class="tag nonprice">가격 외 경쟁</span>${eur(-c.room)} 높음`;
    };
    const bar = (r) => {
      const k = r.total > cap ? cap / r.total : 1, w = (v) => (v * k / scale * 100).toFixed(2) + "%";
      return `<div class="bar${r.total > cap ? " clipped" : ""}" role="img" aria-label="${esc(r.name)} 단가 ${eur(r.price)}, 관세 ${eur(r.duty)}, CBAM ${eur(r.cbam)}, 합계 ${eur(r.total)}">
        <i class="p" style="width:${w(r.price)}"></i><i class="d" style="width:${w(r.duty)}"></i><i class="c" style="width:${w(r.cbam)}"></i><b>${eur(r.total)}</b></div>`;
    };
    const missing = s.rivals.filter((r) => !r.verdict).map((r) => r.nameKo);
    el.innerHTML = `
      <p class="chart-lead">바이어가 내는 톤당 총비용은 한국산 <strong>${eur(ourTotal)}</strong>. 비교한 ${s.comparisons.length}개국 중 <strong>${lower}개국</strong>보다 낮아요.</p>
      <div class="legend"><span><i class="p"></i>단가</span><span><i class="d"></i>관세</span><span><i class="c"></i>CBAM</span><span><i class="ref"></i>우리 총비용</span></div>
      <div class="bars" style="--ref:${(ourTotal / scale * 100).toFixed(2)}%">
        ${rows.map((r) => `<div class="brow${r.ours ? " ours" : ""}"><div class="bname">${esc(r.name)}</div><div class="btrack">${bar(r)}</div><div class="bnote">${note(r)}</div></div>`).join("")}
      </div>
      <p class="hint">${s.year}년 수입분, €/톤. CBAM은 모든 원산지에 공식 기본값을 적용했어요.${rows.some((r) => r.total > cap) ? " 우리 총비용의 2배를 넘는 막대는 잘라서 그렸어요." : ""}${missing.length ? ` 단가나 관세율이 없어 빠진 나라: ${esc(missing.join(", "))}.` : ""}</p>`;
  }

  let lastSheet = null;
  // 협상 메일: 판정이 나온 경쟁국 중 고른 것을 기준으로 쓴다. 언어는 제안서 언어를 따른다.
  function renderMail(s) {
    if (!s || !s.ok) { $("mailSubject").value = ""; $("mailBody").value = ""; return; }
    const opts = s.comparisons;
    if (!opts.some((c) => c.origin === state.mailRival)) state.mailRival = (opts.find((c) => c.verdict === "hold") || opts[0] || {}).origin || "";
    $("mailRival").innerHTML = opts.map((c) => `<option value="${esc(c.origin)}">${esc(c.nameKo)}산 대비 · ${{ hold: "가격 유지", match: "분담 검토", nonprice: "가격 외 경쟁" }[c.verdict]}</option>`).join("")
      + `<option value="">비교 없이 (가격 조항만)</option>`;
    $("mailRival").value = state.mailRival;
    const rival = opts.find((c) => c.origin === state.mailRival) || null;
    const m = window.CBAM_MESSAGES.email(s, rival, { lang: state.lang, company: state.company, buyer: state.buyer, clause: state.clause, relation: s.relation });
    $("mailSubject").value = m.subject;
    $("mailBody").value = m.body;
    $("mailCopied").textContent = "";
  }

  // 제안서 문구. 숫자와 구조는 같고 말만 바뀐다.
  const TEXT = {
    en: {
      company: "Your company", buyer: "Buyer", from: "From", to: "To",
      costH: "Your CBAM cost per tonne", perT: (y) => `${y} imports, per tonne`, certs: "certificates / t",
      markupIn: (m, y) => `default mark-up ${m}% in ${y}`, perYear: (q) => `${q.toLocaleString("en-US")} t per year`, annual: "Annual volume", estimate: (y) => `${y} estimate`,
      thYear: "Import year", thMarkup: "Mark-up", thCerts: "Certificates / t", thCost: "CBAM € / t",
      costSrc: (dv, route, bm) => `Korea default value ${dv} tCO2e/t${route ? ", production route " + route : ""}, CBAM benchmark ${bm}, certificate price ${eur(82.32, 2)} (Q3 2026, published). Later years assume the same price.`,
      compH: (y) => `Total landed cost vs. alternatives (${y})`, thOrigin: "Origin", thPrice: "Unit price", thDuty: "Duty", thTotal: "Total € / t",
      korea: "Korea (us)", fta: "0% (EU–Korea FTA)", name: (c) => c.nameEn,
      compSrc: (m, code) => `${m ? "Unit prices: " + S.MARKET_PRICES.source + ", CN " + fmtCode(code) + ". " : ""}CBAM at official default values for every origin. Quality and lead time not included.`,
      clauseH: "Proposed CBAM price clause",
      clause: (sh, cap) => `Prices exclude CBAM. CBAM per tonne = certificates × certificate price. The supplier bears ${sh}% of it${cap != null ? `, capped at ${eur(cap)} per tonne` : ""}. If verified actual emissions are provided, the certificate count is recalculated.`,
      thSupplier: "Supplier", thBuyer: "Buyer", capped: " (cap)",
      valuesH: "Beyond price", rel: (r) => r.en,
      dataH: "Emissions data we provide", tbd: "To be agreed.", verif: "Verification status:",
      item: (d) => d.en, verifText: (v) => v.en, headline: (t) => t.headline, pitch: (t) => t.pitch,
      rolesH: "What each team in your company gets", thRole: "Team", thNeed: "What they check", thValue: "Answer",
      roles: (s, ourTotal, v) => [
        ["Purchasing", "Total landed cost per tonne", ourTotal != null ? `${eur(ourTotal)} incl. CBAM` : `CBAM ${eur(s.current.cost)} on top of unit price`],
        ["Finance", "How CBAM moves to 2028", `${eur(s.years[0].cost)} → ${eur(s.years[2].cost)} per tonne${state.clause.on && state.clause.cap != null ? `; our share capped at ${eur(state.clause.cap)}` : ""}`],
        ["Sustainability / ESG", "Emissions basis and verification", `Default ${+s.defaultValue.toFixed(3)} tCO2e/t; ${v.en}`],
        ["Customs / CBAM declarant", "Data for the declaration", `CN ${fmtCode(s.code)}, ${s.current.certificates.toFixed(4)} certificates / t`],
      ],
      footer: "Estimate based on EU default values (Implementing Regulations (EU) 2026/1740 and 2025/2620). Not a CBAM declaration and not legal advice. Actual emissions and carbon prices paid in Korea are not included.",
    },
    ko: {
      company: "우리 회사", buyer: "바이어", from: "보내는 곳", to: "받는 곳",
      costH: "톤당 CBAM 비용", perT: (y) => `${y}년 수입분, 톤당`, certs: "인증서 수 / 톤",
      markupIn: (m, y) => `${y}년 기본값 할증 ${m}%`, perYear: (q) => `연간 ${q.toLocaleString("ko-KR")}톤`, annual: "연간 물량", estimate: (y) => `${y}년 추정`,
      thYear: "수입 연도", thMarkup: "할증", thCerts: "인증서 수 / 톤", thCost: "CBAM € / 톤",
      costSrc: (dv, route, bm) => `한국 기본값 ${dv} tCO2e/톤${route ? ", 생산경로 " + route : ""}, CBAM 벤치마크 ${bm}, 인증서 가격 ${eur(82.32, 2)}(2026년 3분기 공표). 2027년 이후는 같은 가격을 가정했습니다.`,
      compH: (y) => `경쟁 원산지와 바이어 총비용 비교 (${y}년)`, thOrigin: "원산지", thPrice: "단가", thDuty: "관세", thTotal: "합계 € / 톤",
      korea: "한국 (당사)", fta: "0% (한-EU FTA)", name: (c) => c.nameKo,
      compSrc: (m, code) => `${m ? "단가: 2025년 독일 수입 평균(Eurostat Comext, CN " + fmtCode(code) + "). " : ""}모든 원산지의 CBAM은 공식 기본값으로 계산했습니다. 품질과 납기는 반영하지 않았습니다.`,
      clauseH: "CBAM 가격 조항 제안",
      clause: (sh, cap) => `가격에는 CBAM이 포함되지 않습니다. 톤당 CBAM 비용은 인증서 수 × 인증서 가격으로 계산하며, 공급사는 그중 ${sh}%를 부담합니다${cap != null ? `(톤당 ${eur(cap)} 상한)` : ""}. 검증된 실제 배출값을 제공하면 인증서 수를 다시 계산합니다.`,
      thSupplier: "공급사", thBuyer: "바이어", capped: " (상한)",
      valuesH: "가격 외에 드리는 가치", rel: (r) => r.ko,
      dataH: "제공하는 배출 자료", tbd: "협의해 정합니다.", verif: "검증 상태:",
      item: (d) => d.ko, verifText: (v) => v.koLong, headline: (t) => t.headlineKo, pitch: (t) => t.pitchKo,
      rolesH: "바이어 회사 안 역할별 핵심", thRole: "담당", thNeed: "확인하는 것", thValue: "답",
      roles: (s, ourTotal, v) => [
        ["구매", "톤당 총조달비용", ourTotal != null ? `CBAM 포함 ${eur(ourTotal)}` : `단가에 CBAM ${eur(s.current.cost)} 추가`],
        ["재무", "2028년까지 CBAM 변화", `톤당 ${eur(s.years[0].cost)} → ${eur(s.years[2].cost)}${state.clause.on && state.clause.cap != null ? `, 당사 분담 상한 ${eur(state.clause.cap)}` : ""}`],
        ["ESG·지속가능성", "배출 근거와 검증 상태", `기본값 ${+s.defaultValue.toFixed(3)} tCO2e/톤, ${v.koLong}`],
        ["통관·CBAM 신고", "신고에 필요한 자료", `CN ${fmtCode(s.code)}, 인증서 ${s.current.certificates.toFixed(4)}장/톤`],
      ],
      footer: "EU 기본값(시행규칙 (EU) 2026/1740, 2025/2620)에 따른 추정치입니다. CBAM 신고서나 법률 자문이 아닙니다. 실제 배출값과 한국에서 낸 탄소가격은 반영하지 않았습니다.",
    },
  };

  function sheetHTML(s) {
    if (!s.ok) return `<div class="empty">${esc(s.reason)}</div>`;
    const L = TEXT[state.lang] || TEXT.en;
    const t = s.type, cur = s.current, today = new Date().toISOString().slice(0, 10);
    const from = state.company.trim() || L.company, to = state.buyer.trim() || L.buyer;
    const other = s.year === 2028 ? s.years[0] : s.years[2];
    const sections = {
      cost: `<h3>${L.costH}</h3>
        <div class="kpis">
          <div class="kpi"><div class="label">${L.perT(s.year)}</div><div class="big">${eur(cur.cost, 2)}</div><div class="sub">${cur.certificates.toFixed(4)} ${L.certs}</div></div>
          <div class="kpi"><div class="label">${L.perT(other.year)}</div><div class="big">${eur(other.cost)}</div><div class="sub">${L.markupIn(Math.round(other.markup * 100), other.year)}</div></div>
          <div class="kpi"><div class="label">${s.qty ? L.perYear(s.qty) : L.annual}</div><div class="big">${s.total ? eur(s.total) : "–"}</div><div class="sub">${L.estimate(s.year)}</div></div>
        </div>
        <table style="margin-top:12px"><thead><tr><th>${L.thYear}</th><th>${L.thMarkup}</th><th>${L.thCerts}</th><th>${L.thCost}</th></tr></thead><tbody>
        ${s.years.map((y) => `<tr><td>${y.year}</td><td>${Math.round(y.markup * 100)}%</td><td>${y.certificates.toFixed(4)}</td><td>${eur(y.cost, 2)}</td></tr>`).join("")}
        </tbody></table>
        <div class="src">${L.costSrc(+s.defaultValue.toFixed(3), s.route, cur.benchmark)}</div>`,
      compare: s.buyerComparisons.length ? `<h3>${L.compH(s.year)}</h3>
        <table><thead><tr><th>${L.thOrigin}</th><th>${L.thPrice}</th><th>${L.thDuty}</th><th>CBAM</th><th>${L.thTotal}</th></tr></thead><tbody>
        <tr class="ours"><td>${L.korea}</td><td>${eur(state.ourPrice)}</td><td>${L.fta}</td><td>${eur(cur.cost)}</td><td>${eur(s.buyerComparisons[0].ourTotal)}</td></tr>
        ${s.buyerComparisons.map((c) => `<tr><td>${esc(L.name(c))}</td><td>${eur(c.price)}</td><td>${c.duty}%</td><td>${eur(c.cbam)}</td><td>${eur(c.rivalTotal)}</td></tr>`).join("")}
        </tbody></table>
        <div class="src">${L.compSrc(s.marketPricesApply, s.code)}</div>` : "",
      clause: s.clause ? `<h3>${L.clauseH}</h3>
        <div class="clause">${L.clause(Math.round(state.clause.share * 100), state.clause.cap)}</div>
        <table><thead><tr><th>${L.thYear}</th><th>${L.thCost}</th><th>${L.thSupplier}</th><th>${L.thBuyer}</th></tr></thead><tbody>
        ${s.clause.map((c) => `<tr><td>${c.year}</td><td>${eur(c.total)}</td><td>${eur(c.seller)}${c.capped ? L.capped : ""}</td><td>${eur(c.buyer)}</td></tr>`).join("")}
        </tbody></table>` : "",
      roles: s.roles ? `<h3>${L.rolesH}</h3>
        <table class="roles"><thead><tr><th>${L.thRole}</th><th>${L.thNeed}</th><th>${L.thValue}</th></tr></thead><tbody>
        ${L.roles(s, s.buyerComparisons.length ? s.buyerComparisons[0].ourTotal : null, s.verification).map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}
        </tbody></table>` : "",
      values: s.values.length ? `<h3>${L.valuesH}</h3><ul>${s.values.map((v) => `<li>${esc(L.item(v))}</li>`).join("")}</ul>` : "",
      data: `<h3>${L.dataH}</h3>
        ${s.dataProvided.length ? `<ul>${s.dataProvided.map((d) => `<li>${esc(L.item(d))}</li>`).join("")}</ul>` : `<p>${L.tbd}</p>`}
        <div class="status"><strong>${L.verif}</strong> ${esc(L.verifText(s.verification))}</div>`,
    };
    return `<header>
        <div><div class="eyebrow">Buyer Value Sheet · EU CBAM · CN ${fmtCode(s.code)}</div><h1>${esc(L.headline(t))}</h1></div>
        <div class="meta">${L.from} <strong>${esc(from)}</strong><br>${L.to} <strong>${esc(to)}</strong><br>CN ${fmtCode(s.code)}<br>${today}</div>
      </header>
      <p class="pitch">${esc(L.rel(s.relationText))}</p>
      <p class="pitch">${esc(L.pitch(t))}</p>
      ${s.lowExposure ? `<p class="src">${state.lang === "ko" ? "귀사의 연간 CBAM 품목 수입이 50톤 이하라면 CBAM이 면제될 수 있습니다. 아래 수치는 그 기준을 넘을 때 적용됩니다." : "If your company's total CBAM imports stay at or below 50 tonnes a year, you may be exempt. The figures below apply above that threshold."}</p>` : ""}
      ${t.order.map((k) => sections[k]).join("")}
      <footer>${L.footer}</footer>`;
  }

  function render(rebuildCompare = true) {
    // 처음 판정이 나온 행은 '가격 유지'일 때만 제안서에 넣는다. 이후는 사용자가 정한다.
    let s = S.build(state);
    if (s.ok) {
      s.rivals.forEach((c, i) => { if (c.verdict && state.rivals[i].include == null) state.rivals[i].include = c.verdict === "hold" && c.price <= 2 * state.ourPrice; }); // 단가가 2배 넘게 차이 나면 다른 제품군일 수 있어 자동으로 넣지 않는다
      s = S.build(state);
    }
    const cov = $("coverage");
    cov.className = "coverage " + (s.ok ? "ok" : "no");
    cov.textContent = s.ok ? "CBAM 대상이고 한국산 기본값으로 계산할 수 있어요." : s.reason;
    const info = BY_CODE[state.code];
    // 한글 품명은 관세청 HS 4·6단위, 8자리 세부 설명은 EU 품목분류표 원문(영어)
    const KN = window.CBAM_KO_NAMES || { h4: {}, h6: {} };
    const k4 = KN.h4[state.code.slice(0, 4)], k6 = KN.h6[state.code.slice(0, 6)];
    $("codeDesc").innerHTML = info ? `${k4 ? `<span class="ko-name">${esc(k4)}${k6 ? `<br>└ ${esc(k6)}` : ""}</span>` : ""}<span class="en-name">${esc(info.desc)}</span>` : "";
    document.querySelectorAll("#year button").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.y) === state.year)));
    if (s.ok) $("segment").innerHTML = `<strong>${esc(s.type.label)}</strong>${esc(s.type.why)}`;
    $("regCheck").innerHTML = S.regCheck(s, state).map((i) => `<li class="${i.level}">${esc(i.text)}</li>`).join("");
    lastSheet = s;
    renderMail(s);
    renderChart(s);
    $("shareOut").textContent = Math.round(state.clause.share * 100) + "%";
    $("clauseInputs").hidden = !state.clause.on;
    $("priceHint").textContent = "단가는 2025년 독일 수입 평균(Eurostat Comext)으로 채웠어요. 물량이 10톤 미만이라 평균이 없는 칸은 비어 있어요. 실제 견적가로 바꾸면 판정이 바뀌어요.";
    if (rebuildCompare) renderCompare(s);
    else updateVerdicts(s);
    document.querySelectorAll("#lang button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.l === state.lang)));
    $("sheet").lang = state.lang;
    $("sheet").innerHTML = sheetHTML(s);
    save();
  }

  // 입력 중인 칸의 포커스를 잃지 않게 다시 그린 뒤 포커스를 돌려준다.
  function updateVerdicts(s) {
    const f = document.activeElement && document.activeElement.closest("#compare") ? document.activeElement : null;
    const pos = f ? [f.dataset.i, f.dataset.k] : null;
    renderCompare(s);
    if (pos) { const el = $("compare").querySelector(`[data-i="${pos[0]}"][data-k="${pos[1]}"]`); if (el) { el.focus(); if (el.type === "number") { const v = el.value; el.value = ""; el.value = v; } } }
  }

  syncInputs();
  render();

  // ---------- 설치형 웹앱 ----------
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("install").hidden = false; });
  $("install").addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $("install").hidden = true; });
})();

// 단계 탭: 한 번에 한 단계만 보여 준다. 오른쪽 제안서는 늘 보인다.
(function () {
  const links = [...document.querySelectorAll("#tabs a")];
  const ids = links.map((a) => a.getAttribute("href").slice(1));
  let cur = 0;
  try { cur = Math.max(0, ids.indexOf(sessionStorage.getItem("cbam-tab"))); } catch { /* 기억 못 해도 된다 */ }
  function show(i) {
    cur = Math.min(ids.length - 1, Math.max(0, i));
    ids.forEach((id, k) => document.getElementById(id).classList.toggle("on", k === cur));
    links.forEach((a, k) => { a.classList.toggle("active", k === cur); a.setAttribute("aria-current", k === cur ? "step" : "false"); });
    document.getElementById("prevStep").disabled = cur === 0;
    document.getElementById("nextStep").hidden = cur === ids.length - 1;
    document.body.dataset.tab = ids[cur]; // 가격 비교 단계에서는 오른쪽에 제안서 대신 그래프를 보여 준다
    try { sessionStorage.setItem("cbam-tab", ids[cur]); } catch { /* 무시 */ }
  }
  links.forEach((a, k) => a.addEventListener("click", (e) => { e.preventDefault(); show(k); }));
  document.getElementById("prevStep").addEventListener("click", () => { show(cur - 1); window.scrollTo({ top: 0 }); });
  document.getElementById("nextStep").addEventListener("click", () => { show(cur + 1); window.scrollTo({ top: 0 }); });
  show(cur);
})();
