// 화면 연결. 계산은 sheet.js / engine.js가 하고, 여기서는 입력을 모으고 그린다.
(function () {
  const S = window.CBAM_SHEET, D = window.CBAM_DATA;
  const $ = (id) => document.getElementById(id);
  const KEY = "cbam-value-sheet-v1";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur = (v, d = 0) => "€" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtCode = (c) => c.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1 $2 $3");
  const codes = D.products[S.PRODUCT].cnCodes;

  function marketRivals(code) {
    return S.MARKET_PRICES.rivals.map((r) => ({
      origin: r.origin, duty: r.duty, include: null,
      price: code === S.MARKET_PRICES.code ? r.price : NaN,
    }));
  }

  function freshState() {
    const code = S.MARKET_PRICES.code;
    return {
      code, year: 2026, qty: 100, ourPrice: S.MARKET_PRICES.ours, rivals: marketRivals(code),
      company: "", buyer: "", buyerType: "distributor",
      dataItems: { cn: true, mill: true, volume: true, installation: false },
      verification: "none", clause: { on: true, share: 0.5, cap: 120 },
    };
  }

  let state;
  try { state = { ...freshState(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { state = freshState(); }
  if (!codes.includes(state.code)) state = freshState();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 못 해도 계산은 된다 */ } };
  const num = (v) => (v === "" || v == null ? NaN : Number(v));

  // ---------- 입력 화면 만들기 ----------
  $("code").innerHTML = codes.map((c) => `<option value="${c}">${fmtCode(c)}${c === S.MARKET_PRICES.code ? " · 육각 볼트, 인장강도 800MPa 이상" : ""}</option>`).join("");
  $("year").innerHTML = S.YEARS.map((y) => `<button type="button" role="radio" data-y="${y}">${y}</button>`).join("");
  $("buyerType").innerHTML = Object.entries(S.BUYER_TYPES).map(([k, t]) =>
    `<button type="button" role="radio" data-k="${k}"><strong>${esc(t.label)}</strong><span>${esc(t.headline)}</span></button>`).join("");
  $("dataItems").innerHTML = "<span>제안서에 적을 제공 자료</span>" + Object.entries(S.DATA_ITEMS).map(([k, v]) =>
    `<label class="check"><input type="checkbox" data-k="${k}"> ${esc(v.ko)}</label>`).join("");
  $("verification").innerHTML = Object.entries(S.VERIFICATION).map(([k, v]) => `<option value="${k}">${esc(v.ko)}</option>`).join("");

  function syncInputs() {
    $("code").value = state.code;
    $("qty").value = Number.isFinite(state.qty) ? state.qty : "";
    $("company").value = state.company;
    $("buyer").value = state.buyer;
    $("ourPrice").value = Number.isFinite(state.ourPrice) ? state.ourPrice : "";
    $("clauseOn").checked = state.clause.on;
    $("share").value = Math.round(state.clause.share * 100);
    $("cap").value = state.clause.cap == null ? "" : state.clause.cap;
    $("verification").value = state.verification;
    document.querySelectorAll("#dataItems input").forEach((el) => (el.checked = !!state.dataItems[el.dataset.k]));
  }

  // ---------- 이벤트 ----------
  $("code").addEventListener("change", (e) => {
    state.code = e.target.value;
    state.rivals = marketRivals(state.code);
    state.ourPrice = state.code === S.MARKET_PRICES.code ? S.MARKET_PRICES.ours : NaN;
    syncInputs(); render();
  });
  $("year").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { state.year = Number(b.dataset.y); render(); } });
  $("buyerType").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { state.buyerType = b.dataset.k; render(); } });
  [["qty", "qty"], ["ourPrice", "ourPrice"]].forEach(([id, k]) => $(id).addEventListener("input", (e) => { state[k] = num(e.target.value); render(); }));
  [["company", "company"], ["buyer", "buyer"]].forEach(([id, k]) => $(id).addEventListener("input", (e) => { state[k] = e.target.value; render(); }));
  $("clauseOn").addEventListener("change", (e) => { state.clause.on = e.target.checked; render(); });
  $("share").addEventListener("input", (e) => { state.clause.share = Number(e.target.value) / 100; render(); });
  $("cap").addEventListener("input", (e) => { const v = num(e.target.value); state.clause.cap = Number.isFinite(v) ? v : null; render(); });
  $("verification").addEventListener("change", (e) => { state.verification = e.target.value; render(); });
  $("dataItems").addEventListener("change", (e) => { if (e.target.dataset.k) { state.dataItems[e.target.dataset.k] = e.target.checked; render(); } });
  $("compare").addEventListener("input", (e) => {
    const el = e.target, r = state.rivals[el.dataset.i];
    if (!r) return;
    if (el.dataset.k === "include") r.include = el.checked;
    else r[el.dataset.k] = num(el.value);
    render(false);
  });
  $("print").addEventListener("click", () => window.print());

  // ---------- 그리기 ----------
  function renderCompare(s) {
    const byOrigin = Object.fromEntries((s.comparisons || []).map((c) => [c.origin, c]));
    $("compare").innerHTML = state.rivals.map((r, i) => {
      const c = byOrigin[r.origin];
      let verdict = `<span class="hint">단가를 넣으면 판정이 나와요</span>`;
      if (c) {
        if (c.verdict === "hold") verdict = `<span class="tag hold">가격 유지</span> 바이어 총비용이 우리가 ${eur(c.room)} 낮아요. 분담을 거절할 근거가 있어요.`;
        if (c.verdict === "match") verdict = `<span class="tag match">분담 검토</span> 단가를 ${eur(c.needed)} 낮추면 같아져요 (CBAM의 ${Math.round(c.share * 100)}%).`;
        if (c.verdict === "nonprice") verdict = `<span class="tag nonprice">가격 외 경쟁</span> CBAM을 다 양보해도 ${eur(-c.room)} 비싸요. 품질·납기로 설득해야 해요.`;
      }
      return `<div class="crow">
        <div class="top"><strong>${esc(D.originNames[r.origin])}산과 비교</strong>
          <label class="check" style="margin:0"><input type="checkbox" data-i="${i}" data-k="include" ${r.include ? "checked" : ""} ${c ? "" : "disabled"}> 제안서에 넣기</label></div>
        <div class="inputs">
          <input type="number" min="0" step="1" data-i="${i}" data-k="price" value="${Number.isFinite(r.price) ? r.price : ""}" placeholder="단가 €/t" aria-label="${esc(D.originNames[r.origin])} 단가">
          <input type="number" min="0" step="0.1" data-i="${i}" data-k="duty" value="${r.duty}" aria-label="${esc(D.originNames[r.origin])} 관세율 %">
        </div>
        <div class="verdict">${verdict}</div></div>`;
    }).join("");
  }

  function sheetHTML(s) {
    if (!s.ok) return `<div class="empty">${esc(s.coverage.message)}</div>`;
    const t = s.type, cur = s.current, today = new Date().toISOString().slice(0, 10);
    const from = state.company.trim() || "Your company", to = state.buyer.trim() || "Buyer";
    const sections = {
      cost: `<h3>Your CBAM cost per tonne</h3>
        <div class="kpis">
          <div class="kpi"><div class="label">${s.year} imports, per tonne</div><div class="big">${eur(cur.cost, 2)}</div><div class="sub">${cur.certificates.toFixed(4)} certificates / t</div></div>
          ${s.year === 2028
            ? `<div class="kpi"><div class="label">2026 imports, per tonne</div><div class="big">${eur(s.years[0].cost)}</div><div class="sub">default mark-up 10% in 2026</div></div>`
            : `<div class="kpi"><div class="label">2028 imports, per tonne</div><div class="big">${eur(s.years[2].cost)}</div><div class="sub">default mark-up rises to 30%</div></div>`}
          <div class="kpi"><div class="label">${s.qty ? `${s.qty.toLocaleString("en-US")} t per year` : "Annual volume"}</div><div class="big">${s.total ? eur(s.total) : "–"}</div><div class="sub">${s.year} estimate</div></div>
        </div>
        <table style="margin-top:12px"><thead><tr><th>Import year</th><th>Mark-up</th><th>Certificates / t</th><th>CBAM € / t</th></tr></thead><tbody>
        ${s.years.map((y, i) => `<tr><td>${y.year}</td><td>${[10, 20, 30][i]}%</td><td>${y.certificates.toFixed(4)}</td><td>${eur(y.cost, 2)}</td></tr>`).join("")}
        </tbody></table>
        <div class="src">Korea default value 3.474 tCO2e/t, benchmark 1.364, certificate price ${eur(82.32, 2)} (Q3 2026, published). Later years assume the same price.</div>`,
      compare: s.buyerComparisons.length ? `<h3>Total landed cost vs. alternatives (${s.year})</h3>
        <table><thead><tr><th>Origin</th><th>Unit price</th><th>Duty</th><th>CBAM</th><th>Total € / t</th></tr></thead><tbody>
        <tr class="ours"><td>Korea (us)</td><td>${eur(state.ourPrice)}</td><td>0% (EU–Korea FTA)</td><td>${eur(cur.cost)}</td><td>${eur(s.buyerComparisons[0].ourTotal)}</td></tr>
        ${s.buyerComparisons.map((c) => `<tr><td>${esc(enName(c.origin))}</td><td>${eur(c.price)}</td><td>${c.duty}%</td><td>${eur(c.rivalTotal - c.price * (1 + c.duty / 100))}</td><td>${eur(c.rivalTotal)}</td></tr>`).join("")}
        </tbody></table>
        <div class="src">${s.marketPricesApply ? "Unit prices: " + S.MARKET_PRICES.source + ". " : ""}CBAM at default values for every origin. Quality and lead time not included.</div>` : "",
      clause: s.clause ? `<h3>Proposed CBAM price clause</h3>
        <div class="clause">Prices exclude CBAM. CBAM per tonne = certificates × certificate price. The supplier bears ${Math.round(state.clause.share * 100)}% of it${state.clause.cap != null ? `, capped at ${eur(state.clause.cap)} per tonne` : ""}. If verified actual emissions are provided, the certificate count is recalculated.</div>
        <table><thead><tr><th>Import year</th><th>CBAM € / t</th><th>Supplier</th><th>Buyer</th></tr></thead><tbody>
        ${s.clause.map((c) => `<tr><td>${c.year}</td><td>${eur(c.total)}</td><td>${eur(c.seller)}${c.capped ? " (cap)" : ""}</td><td>${eur(c.buyer)}</td></tr>`).join("")}
        </tbody></table>` : "",
      data: `<h3>Emissions data we provide</h3>
        ${s.dataProvided.length ? `<ul>${s.dataProvided.map((d) => `<li>${esc(d.en)}</li>`).join("")}</ul>` : "<p>To be agreed.</p>"}
        <div class="status"><strong>Verification status:</strong> ${esc(s.verification.en)}</div>`,
    };
    return `<header>
        <div><div class="eyebrow">Buyer Value Sheet · EU CBAM</div><h1>${esc(t.headline)}</h1></div>
        <div class="meta">From <strong>${esc(from)}</strong><br>To <strong>${esc(to)}</strong><br>CN ${fmtCode(s.code)}<br>${today}</div>
      </header>
      <p class="pitch">${esc(t.pitch)}</p>
      ${t.order.map((k) => sections[k]).join("")}
      <footer>Estimate based on EU default values (Implementing Regulations (EU) 2026/1740 and 2025/2620). Not a CBAM declaration and not legal advice. Actual emissions and carbon prices paid in Korea are not included.</footer>`;
  }

  const EN = { TW: "Taiwan", IN: "India", TR: "Türkiye", VN: "Vietnam", CN: "China", JP: "Japan", KR: "Korea" };
  const enName = (o) => EN[o] || o;

  function render(rebuildCompare = true) {
    // 처음 판정이 나온 행은 '가격 유지'일 때만 제안서에 넣는다. 이후는 사용자가 정한다.
    let s = S.build(state);
    if (s.ok) {
      s.comparisons.forEach((c) => { const r = state.rivals.find((x) => x.origin === c.origin); if (r.include == null) r.include = c.verdict === "hold"; });
      s = S.build(state);
    }
    const cov = $("coverage");
    cov.className = "coverage " + (s.ok ? "ok" : "no");
    cov.textContent = s.coverage.message;
    document.querySelectorAll("#year button").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.y) === state.year)));
    document.querySelectorAll("#buyerType button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.k === state.buyerType)));
    $("shareOut").textContent = Math.round(state.clause.share * 100) + "%";
    $("clauseInputs").hidden = !state.clause.on;
    $("priceHint").textContent = state.code === S.MARKET_PRICES.code
      ? "기본으로 채운 단가는 2025년 독일 통관 평균(Comext)이에요. 실제 견적가로 바꾸면 판정이 바뀌어요."
      : "이 코드는 시장 평균 단가가 없어요. 우리 단가와 경쟁 단가를 직접 넣어 주세요.";
    if (rebuildCompare) renderCompare(s);
    else updateVerdicts(s);
    $("sheet").innerHTML = sheetHTML(s);
    save();
  }

  // 입력 중인 칸의 포커스를 잃지 않게 판정 글만 바꾼다.
  function updateVerdicts(s) {
    const focused = document.activeElement && document.activeElement.closest("#compare") ? document.activeElement : null;
    const pos = focused ? [focused.dataset.i, focused.dataset.k] : null;
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
