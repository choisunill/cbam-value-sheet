// 화면 연결. 계산은 sheet.js / catalog.js / engine.js가 하고, 여기서는 입력을 모으고 그린다.
(function () {
  const S = window.CBAM_SHEET, K = window.CBAM_CATALOG;
  const $ = (id) => document.getElementById(id);
  const KEY = "cbam-value-sheet-v2";
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
      code, year: 2026, qty: 100, ourPrice: S.MARKET_PRICES.ours,
      rivals: S.DEFAULT_RIVALS.map((o) => rivalFor(code, o)),
      company: "", buyer: "", buyerType: "distributor",
      dataItems: { cn: true, mill: true, volume: true, installation: false },
      verification: "none", clause: { on: true, share: 0.5, cap: 120 },
    };
  }

  let state;
  try { state = { ...freshState(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { state = freshState(); }
  if (!BY_CODE[state.code]) state = freshState();
  state.rivals.forEach((r) => { r.price = num(r.price); r.duty = num(r.duty); }); // JSON에서 NaN이 null로 돌아온다
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 못 해도 계산은 된다 */ } };

  // ---------- 입력 화면 만들기 ----------
  const sectorKo = { steel: "철강", aluminium: "알루미늄" };
  $("codeList").innerHTML = ALL.map((c) => `<option value="${fmtCode(c.cn)}">${sectorKo[c.sector]} · ${esc(c.desc.slice(0, 90))}</option>`).join("");
  $("year").innerHTML = S.YEARS.map((y) => `<button type="button" role="radio" data-y="${y}">${y}</button>`).join("");
  $("buyerType").innerHTML = Object.entries(S.BUYER_TYPES).map(([k, t]) =>
    `<button type="button" role="radio" data-k="${k}"><strong>${esc(t.label)}</strong><span>${esc(t.headline)}</span></button>`).join("");
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
    $("code").value = fmtCode(state.code);
    $("qty").value = Number.isFinite(state.qty) ? state.qty : "";
    $("company").value = state.company;
    $("buyer").value = state.buyer;
    $("ourPrice").value = Number.isFinite(state.ourPrice) ? state.ourPrice : "";
    $("clauseOn").checked = state.clause.on;
    $("share").value = Math.round(state.clause.share * 100);
    $("cap").value = state.clause.cap == null ? "" : state.clause.cap;
    $("verification").value = state.verification;
    document.querySelectorAll("#dataItems input").forEach((el) => (el.checked = !!state.dataItems[el.dataset.k]));
    renderAddRival();
  }

  // ---------- 이벤트 ----------
  $("code").addEventListener("input", (e) => {
    const cn = e.target.value.replace(/\D/g, "");
    if (cn.length !== 8 || !BY_CODE[cn]) { $("codeDesc").textContent = cn.length >= 4 ? "목록에서 8자리 코드를 골라 주세요." : ""; return; }
    if (cn === state.code) return;
    state.code = cn;
    state.rivals = state.rivals.map((r) => rivalFor(cn, r.origin));
    state.ourPrice = cn === S.MARKET_PRICES.code ? S.MARKET_PRICES.ours : NaN;
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

  // ---------- 그리기 ----------
  function renderCompare(s) {
    const rows = s.ok ? s.rivals : [];
    $("compare").innerHTML = rows.map((r, i) => {
      let verdict = r.cbam == null ? `<span class="hint">${esc(r.cbamReason)}</span>` : `<span class="hint">단가와 관세율을 넣으면 판정이 나와요</span>`;
      if (r.verdict === "hold") verdict = `<span class="tag hold">가격 유지</span> 바이어 총비용이 우리가 ${eur(r.room)} 낮아요. 분담을 거절할 근거가 있어요.`;
      if (r.verdict === "match") verdict = `<span class="tag match">분담 검토</span> 단가를 ${eur(r.needed)} 낮추면 같아져요 (CBAM의 ${Math.round(r.share * 100)}%).`;
      if (r.verdict === "nonprice") verdict = `<span class="tag nonprice">가격 외 경쟁</span> CBAM을 다 양보해도 ${eur(-r.room)} 비싸요. 품질·납기로 설득해야 해요.`;
      return `<div class="crow">
        <div class="top"><strong>${esc(r.nameKo)}산과 비교</strong>
          <span><label class="check" style="margin:0;display:inline-flex"><input type="checkbox" data-i="${i}" data-k="include" ${r.include ? "checked" : ""} ${r.verdict ? "" : "disabled"}> 제안서에 넣기</label>
          <button type="button" class="remove" data-i="${i}" aria-label="${esc(r.nameKo)} 빼기">✕</button></span></div>
        <div class="cbam">${r.cbam != null ? `CBAM ${eur(r.cbam)}/t · 공식 기본값 ${+r.defaultValue.toFixed(3)} tCO2e/t` : ""}</div>
        <div class="inputs">
          <input type="number" min="0" step="1" data-i="${i}" data-k="price" value="${Number.isFinite(r.price) ? r.price : ""}" placeholder="단가 €/t" aria-label="${esc(r.nameKo)} 단가">
          <input type="number" min="0" step="0.1" data-i="${i}" data-k="duty" value="${Number.isFinite(r.duty) ? r.duty : ""}" placeholder="관세 %" aria-label="${esc(r.nameKo)} 관세율 %">
        </div>
        <div class="verdict">${verdict}</div></div>`;
    }).join("");
  }

  function sheetHTML(s) {
    if (!s.ok) return `<div class="empty">${esc(s.reason)}</div>`;
    const t = s.type, cur = s.current, today = new Date().toISOString().slice(0, 10);
    const from = state.company.trim() || "Your company", to = state.buyer.trim() || "Buyer";
    const other = s.year === 2028 ? s.years[0] : s.years[2];
    const sections = {
      cost: `<h3>Your CBAM cost per tonne</h3>
        <div class="kpis">
          <div class="kpi"><div class="label">${s.year} imports, per tonne</div><div class="big">${eur(cur.cost, 2)}</div><div class="sub">${cur.certificates.toFixed(4)} certificates / t</div></div>
          <div class="kpi"><div class="label">${other.year} imports, per tonne</div><div class="big">${eur(other.cost)}</div><div class="sub">default mark-up ${Math.round(other.markup * 100)}% in ${other.year}</div></div>
          <div class="kpi"><div class="label">${s.qty ? `${s.qty.toLocaleString("en-US")} t per year` : "Annual volume"}</div><div class="big">${s.total ? eur(s.total) : "–"}</div><div class="sub">${s.year} estimate</div></div>
        </div>
        <table style="margin-top:12px"><thead><tr><th>Import year</th><th>Mark-up</th><th>Certificates / t</th><th>CBAM € / t</th></tr></thead><tbody>
        ${s.years.map((y) => `<tr><td>${y.year}</td><td>${Math.round(y.markup * 100)}%</td><td>${y.certificates.toFixed(4)}</td><td>${eur(y.cost, 2)}</td></tr>`).join("")}
        </tbody></table>
        <div class="src">Korea default value ${+s.defaultValue.toFixed(3)} tCO2e/t${s.route ? ", production route " + s.route : ""}, CBAM benchmark ${cur.benchmark}, certificate price ${eur(82.32, 2)} (Q3 2026, published). Later years assume the same price.</div>`,
      compare: s.buyerComparisons.length ? `<h3>Total landed cost vs. alternatives (${s.year})</h3>
        <table><thead><tr><th>Origin</th><th>Unit price</th><th>Duty</th><th>CBAM</th><th>Total € / t</th></tr></thead><tbody>
        <tr class="ours"><td>Korea (us)</td><td>${eur(state.ourPrice)}</td><td>0% (EU–Korea FTA)</td><td>${eur(cur.cost)}</td><td>${eur(s.buyerComparisons[0].ourTotal)}</td></tr>
        ${s.buyerComparisons.map((c) => `<tr><td>${esc(c.nameEn)}</td><td>${eur(c.price)}</td><td>${c.duty}%</td><td>${eur(c.cbam)}</td><td>${eur(c.rivalTotal)}</td></tr>`).join("")}
        </tbody></table>
        <div class="src">${s.marketPricesApply ? "Unit prices: " + S.MARKET_PRICES.source + ". " : ""}CBAM at official default values for every origin. Quality and lead time not included.</div>` : "",
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

  function render(rebuildCompare = true) {
    // 처음 판정이 나온 행은 '가격 유지'일 때만 제안서에 넣는다. 이후는 사용자가 정한다.
    let s = S.build(state);
    if (s.ok) {
      s.rivals.forEach((c, i) => { if (c.verdict && state.rivals[i].include == null) state.rivals[i].include = c.verdict === "hold"; });
      s = S.build(state);
    }
    const cov = $("coverage");
    cov.className = "coverage " + (s.ok ? "ok" : "no");
    cov.textContent = s.ok ? "CBAM 대상이고 한국산 기본값으로 계산할 수 있어요." : s.reason;
    const info = BY_CODE[state.code];
    $("codeDesc").textContent = info ? `${sectorKo[info.sector]} · ${info.desc}` : "";
    document.querySelectorAll("#year button").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.y) === state.year)));
    document.querySelectorAll("#buyerType button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.k === state.buyerType)));
    $("shareOut").textContent = Math.round(state.clause.share * 100) + "%";
    $("clauseInputs").hidden = !state.clause.on;
    $("priceHint").textContent = state.code === S.MARKET_PRICES.code
      ? "단가는 2025년 독일 통관 평균(Comext)으로 채웠어요. 실제 견적가로 바꾸면 판정이 바뀌어요."
      : "경쟁국 CBAM은 공식 기본값으로 자동 계산돼요. 단가와 관세율은 직접 넣어 주세요.";
    if (rebuildCompare) renderCompare(s);
    else updateVerdicts(s);
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
