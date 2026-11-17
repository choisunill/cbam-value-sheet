// 드롭다운을 둥근 카드 목록으로 보여 준다. 원래 <select>는 숨겨 두고 값과 change 이벤트를 그대로 쓰므로 app.js는 바꾸지 않는다.
(function () {
  const VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const INDEX = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
  const CHECK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  let open = null; // { sel, list, btn }
  let uid = 0;

  function enhance(sel) {
    if (sel._dd) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    sel.after(btn);
    sel.classList.add("dd-native");
    sel.tabIndex = -1;
    sel._dd = btn;
    const label = sel.getAttribute("aria-label") || sel.closest("label")?.querySelector("span")?.textContent || "";
    const update = () => {
      const o = sel.options[INDEX.get.call(sel)];
      btn.textContent = o ? o.textContent : "";
      btn.setAttribute("aria-label", `${label} ${btn.textContent}`.trim());
      btn.disabled = sel.disabled;
    };
    // app.js가 값을 코드로 바꿀 때도 버튼 글자를 맞춘다
    Object.defineProperty(sel, "value", { configurable: true, get() { return VALUE.get.call(this); }, set(v) { VALUE.set.call(this, v); update(); } });
    Object.defineProperty(sel, "selectedIndex", { configurable: true, get() { return INDEX.get.call(this); }, set(v) { INDEX.set.call(this, v); update(); } });
    new MutationObserver(update).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    sel.addEventListener("change", update);
    btn.addEventListener("click", () => (open && open.sel === sel ? close() : show(sel)));
    btn.addEventListener("keydown", (e) => { if (!open && ["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); show(sel); } });
    update();
  }

  function show(sel) {
    close();
    const btn = sel._dd, list = document.createElement("div");
    list.className = "dd-list";
    list.id = `dd-${++uid}`;
    list.setAttribute("role", "listbox");
    const cur = INDEX.get.call(sel);
    let html = "", lastGroup = null;
    [...sel.options].forEach((o, k) => {
      const g = o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : null;
      if (g && g !== lastGroup) html += `<div class="dd-group">${esc(g)}</div>`;
      lastGroup = g;
      html += `<div class="dd-opt${k === cur ? " on" : ""}${o.disabled ? " off" : ""}" role="option" data-k="${k}" aria-selected="${k === cur}"><span>${esc(o.textContent || "—")}</span>${k === cur ? CHECK : ""}</div>`;
    });
    list.innerHTML = html;
    if (sel.options.length > 15 && matchMedia("(hover: hover)").matches) {
      const q = document.createElement("input");
      q.className = "dd-search";
      q.type = "search";
      q.placeholder = document.documentElement.lang === "en" ? "Search" : "검색";
      q.setAttribute("aria-label", q.placeholder);
      list.prepend(q);
      q.addEventListener("input", () => {
        const v = q.value.trim().toLowerCase();
        list.querySelectorAll(".dd-group").forEach((g) => (g.hidden = !!v));
        let first = null;
        list.querySelectorAll(".dd-opt").forEach((o) => {
          o.hidden = !!v && !o.textContent.toLowerCase().includes(v);
          if (!o.hidden && !o.classList.contains("off") && first == null) first = +o.dataset.k;
        });
        if (first != null) mark(first);
      });
      setTimeout(() => q.focus({ preventScroll: true })); // 포커스 때문에 페이지가 스크롤되면 목록이 닫힌다
    }
    document.body.append(list);
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-controls", list.id);
    open = { sel, list, btn, k: cur };
    place();
    mark(cur);
    list.addEventListener("mousedown", (e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); }); // 누르는 동안 포커스가 빠지지 않게(검색칸은 예외)
    list.addEventListener("click", (e) => { const o = e.target.closest(".dd-opt:not(.off)"); if (o) pick(+o.dataset.k); });
  }

  function place() {
    if (!open) return;
    const r = open.btn.getBoundingClientRect(), l = open.list;
    l.style.minWidth = r.width + "px";
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 220 && above > below;
    l.style.maxHeight = Math.min(340, up ? above : below) + "px";
    l.style.left = Math.min(r.left, innerWidth - l.offsetWidth - 8) + "px";
    l.style.top = (up ? r.top - l.offsetHeight - 6 : r.bottom + 6) + "px";
  }

  function mark(k) {
    if (!open) return;
    open.k = k;
    open.list.querySelectorAll(".dd-opt").forEach((n) => n.classList.toggle("hover", +n.dataset.k === k));
    // 목록 안에서만 스크롤한다. scrollIntoView는 페이지까지 움직여서 scroll 이벤트로 목록이 닫힌다.
    const n = open.list.querySelector(`.dd-opt[data-k="${k}"]`), l = open.list;
    if (n && n.offsetTop < l.scrollTop) l.scrollTop = n.offsetTop - 6;
    else if (n && n.offsetTop + n.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = n.offsetTop + n.offsetHeight - l.clientHeight + 6;
  }

  function pick(k) {
    const { sel, btn } = open;
    close();
    btn.focus();
    if (k === INDEX.get.call(sel)) return;
    sel.selectedIndex = k;
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function close() {
    if (!open) return;
    open.list.remove();
    open.btn.setAttribute("aria-expanded", "false");
    open = null;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  document.addEventListener("keydown", (e) => {
    if (!open) return;
    const opts = [...open.sel.options], inSearch = e.target.classList?.contains("dd-search");
    const hid = (k) => open.list.querySelector(`.dd-opt[data-k="${k}"]`)?.hidden;
    const step = (d, from = open.k) => { let k = from; do { k += d; } while (opts[k] && (opts[k].disabled || hid(k))); if (opts[k]) mark(k); };
    if (e.key === "Escape") { e.preventDefault(); const b = open.btn; close(); b.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
    else if ((e.key === "Home" || e.key === "End") && !inSearch) { e.preventDefault(); e.key === "Home" ? step(1, -1) : step(-1, opts.length); }
    else if (e.key === "Enter" || (e.key === " " && !inSearch)) { e.preventDefault(); if (!hid(open.k)) pick(open.k); }
    else if (e.key === "Tab") close();
  }, true);
  document.addEventListener("mousedown", (e) => { if (open && !open.list.contains(e.target) && e.target !== open.btn) close(); });
  addEventListener("resize", close);
  addEventListener("scroll", (e) => { if (open && !open.list.contains(e.target)) close(); }, true);

  // 처음 있는 것과 나중에 그려지는 것(바이어 진단 질문 등) 모두
  document.querySelectorAll("select").forEach(enhance);
  new MutationObserver(() => document.querySelectorAll("select:not(.dd-native)").forEach(enhance))
    .observe(document.body, { childList: true, subtree: true });
})();
