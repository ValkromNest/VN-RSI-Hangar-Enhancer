// ==============================
// RSI Pledges — Card Enhancer
// ==============================
(function () {
  "use strict";

  const MONEY_RE = /\$?\s*([\d,]+(?:\.\d{2})?)/;

  const qs = (el, sel) => el?.querySelector(sel) || null;
  const qsa = (el, sel) => Array.from((el || document).querySelectorAll(sel));
  const txt = (el) => (el?.textContent || "").trim();
  const val = (el) => (el && typeof el.value === "string" ? el.value.trim() : "");

  const parseMoney = (s) => {
    if (!s) return 0;
    const m = s.match(MONEY_RE);
    return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
  };
  const moneyStr = (num) => `$${num.toFixed(2)} USD`;

  function isUpgradedCard(row) {
    return !!qs(row, "h3.upgraded") || !!qs(row, ".title-col .upgraded");
  }

  function getHidden(row, cls) { return val(qs(row, cls)); }

  function getShipTitleFromItems(row) {
    const items = qsa(row, ".with-images .item .text");
    for (const t of items) {
      const kind = txt(qs(t, ".kind"));
      if (kind.toLowerCase() === "ship") {
        const title = txt(qs(t, ".title"));
        if (title) return title;
      }
    }
    const contains = qs(row, ".items-col");
    if (contains) {
      const label = qs(contains, "label");
      const s = txt(contains).replace(
        new RegExp(`^${label ? label.textContent.trim() : "Contains:"}\\s*`, "i"),
        ""
      );
      return s.split(/ and /i)[0].trim();
    }
    return null;
  }

  function getShipImageUrl(row) {
    const shipItem = qsa(row, ".with-images .item").find((item) => {
      const k = txt(qs(item, ".text .kind"));
      return k && k.toLowerCase() === "ship";
    });
    if (!shipItem) return null;
    const imgDiv = qs(shipItem, ".image");
    if (!imgDiv) return null;
    const bg = imgDiv.style.backgroundImage || "";
    const m = bg.match(/url\((['"]?)(.*?)\1\)/i);
    return m ? m[2] : null;
  }

  function setHeaderImage(row, url) {
    const headerImg = qs(row, ".item-image-wrapper .image");
    if (headerImg && url) headerImg.style.backgroundImage = `url('${url}')`;
  }

  function getInsurance(row) {
    const list = [];
    const texts = qsa(row, ".with-images .item .text");
    for (const t of texts) {
      const kind = txt(qs(t, ".kind"));
      if (kind.toLowerCase() === "insurance") {
        const title = txt(qs(t, ".title"));
        if (title) list.push(title);
      }
    }
    const plain = qsa(row, ".without-images .item .title");
    for (const p of plain) {
      const t = txt(p);
      if (/insurance/i.test(t)) list.push(t);
    }
    if (list.some((x) => /lifetime/i.test(x))) return "Lifetime Insurance";
    const months = list
      .map((x) => {
        const m = x.match(/(\d+)\s*Month/i);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter(Boolean)
      .sort((a, b) => b - a);
    if (months.length) return `${months[0]} Month Insurance`;
    return "—";
  }

  function addItemsColLike(row, labelText, valueText, key) {
    const wrapper = qs(row, ".wrapper-col");
    if (!wrapper) return;
    if (qs(wrapper, `.items-col[data-rsipe='${key}']`)) return;

    const div = document.createElement("div");
    div.className = "items-col";
    div.setAttribute("data-rsipe", key);

    const label = document.createElement("label");
    label.textContent = labelText;
    div.appendChild(label);
    div.appendChild(document.createTextNode(" " + valueText));

    const itemsCols = qsa(wrapper, ".items-col");
    if (itemsCols.length) {
      itemsCols[itemsCols.length - 1].insertAdjacentElement("afterend", div);
    } else {
      const dateCol = qs(wrapper, ".date-col");
      if (dateCol) dateCol.insertAdjacentElement("afterend", div);
      else wrapper.appendChild(div);
    }
  }

  function applyUpgradedVisuals(row, currentShip) {
    const titleCol = qs(row, ".title-col");
    if (titleCol) {
      const h3 = qs(titleCol, "h3");
      if (h3) {
        const original = txt(h3);
        if (currentShip && currentShip !== original) {
          h3.textContent = currentShip;
          if (!qs(titleCol, ".rsipe-subtitle")) {
            const sub = document.createElement("div");
            sub.className = "rsipe-subtitle";
            sub.textContent = `Origine: ${original}`;
            h3.insertAdjacentElement("afterend", sub);
          }
        }
      }
    }
    const newImg = getShipImageUrl(row);
    if (newImg) setHeaderImage(row, newImg);
  }

  function processRow(row) {
    if (row.__rsipe_done) return;
    row.__rsipe_done = true;

    const isUp = isUpgradedCard(row);
    const mv = parseMoney(getHidden(row, ".js-pledge-value"));
    const ins = getInsurance(row);
    const shipNow = getShipTitleFromItems(row);

    if (isUp) applyUpgradedVisuals(row, shipNow);
    if (mv > 0) addItemsColLike(row, "Melt value:", moneyStr(mv), "melt");
    addItemsColLike(row, "Assicurazione:", ins, "insurance");
  }

  function scan() { qsa(document, ".row.trans-background").forEach(processRow); }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();


// =======================================================================
// RSI Pledges — Floating Search + ALWAYS client-side pager (RSI style)
// =======================================================================
(function () {
  "use strict";

  // Utils
  const qs = (el, sel) => (el ? el.querySelector(sel) : document.querySelector(sel));
  const qsa = (el, sel) => (el ? Array.from(el.querySelectorAll(sel)) : Array.from(document.querySelectorAll(sel)));
  const txt = (el) => (el && el.textContent ? el.textContent.trim() : "");
  const val = (el) => (el && typeof el.value === "string" ? el.value.trim() : "");
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // Stato generale
  const state = { query: "", page: 0, pageSize: 10, pagerBuilt: false, key: "" };
  let currentFiltered = [];               // cards correnti (filtrate o complete)
  const loadedPages = new Set();          // anti-duplica fetch

  // ---- CONTEX + PAGER NATIVO ----
  function getPagerSlots() { return Array.from(document.querySelectorAll(".js-pager .right, .js-pager .left")); }
  function getActivePagerLink() {
    return qs(null, ".js-pager .right a.active") ||
           qs(null, ".js-pager .right a.trans-02s.trans-color.active") ||
           qs(null, ".js-pager .right a");
  }
  function getPageSize() {
    try {
      const a = getActivePagerLink();
      const href = a ? a.getAttribute("href") || "" : "";
      const m = href.match(/pagesize=(\d+)/i);
      if (m) return Math.max(1, parseInt(m[1], 10));
    } catch {}
    return 10;
  }
  function getTotalPagesFromPager() {
    const links = qsa(null, ".js-pager .right a");
    const pages = links.map((a) => {
      const href = a.getAttribute("href") || "";
      const m = href.match(/page=(\d+)/i);
      return m ? parseInt(m[1], 10) : NaN;
    }).filter(Number.isFinite);
    return pages.length ? Math.max(...pages) : 1;
  }
  function getProductType() {
    const input = qs(null, ".product-type-filter .js-form-data");
    const q = input ? input.value : "";
    const m = /product-type=([^&]+)/.exec(q) || /product-type=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }
  function getKey() { return `${getProductType()}|${getPageSize()}`; }

  // ---- CARICAMENTO SOTTOPAGINE ----
  function getAllCards() { return qsa(null, ".row.trans-background"); }
  function getRowsContainer() {
    const first = qs(null, ".row.trans-background");
    return first ? first.parentElement : null;
  }

  async function ensureAllPagesLoaded() {
    const totalPages = getTotalPagesFromPager();
    const container = getRowsContainer();
    if (!container) return;

    // Marca la pagina attuale (se non marcata)
    const firstUnmarked = getAllCards().some(n => !n.hasAttribute("data-rsipe-page"));
    if (firstUnmarked) {
      let curr = 1;
      const a = getActivePagerLink();
      if (a) {
        const href = a.getAttribute("href") || "";
        const m = href.match(/page=(\d+)/i);
        if (m) curr = parseInt(m[1], 10) || 1;
      }
      getAllCards().forEach((n, idx) => {
        if (!n.hasAttribute("data-rsipe-page")) n.setAttribute("data-rsipe-page", String(curr));
        if (!n.hasAttribute("data-rsipe-idx")) n.setAttribute("data-rsipe-idx", String(idx)); // ordine originale pagina
      });
      loadedPages.add(curr);
    }

    // Carica il resto una sola volta
    for (let p = 1; p <= totalPages; p++) {
      if (loadedPages.has(p)) continue;
      try {
        const u = new URL(location.href);
        u.searchParams.set("page", String(p));
        const html = await fetch(u.href, { credentials: "same-origin" }).then((r) => r.text());
        const doc = new DOMParser().parseFromString(html, "text/html");
        const rows = Array.from(doc.querySelectorAll(".row.trans-background"));
        rows.forEach((row, idx) => {
          const imported = document.importNode(row, true);
          imported.style.display = "none";
          imported.setAttribute("data-rsipe-page", String(p));
          imported.setAttribute("data-rsipe-idx", String(idx));
          container.appendChild(imported);
        });
        loadedPages.add(p);
      } catch (e) {
        console.warn("[RSI Enhancer] fetch page failed", p, e);
      }
    }
  }

  // ---- ORDINAMENTO PER DATA (DESC) ----
  function parseDateFlexible(text) {
    if (!text) return NaN;
    // Prova Date.parse nativo
    let t = Date.parse(text);
    if (!Number.isNaN(t)) return t;

    // dd/mm/yyyy o dd-mm-yyyy o dd.mm.yyyy
    let m = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (m) {
      const d = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1, y = parseInt(m[3], 10);
      t = new Date(y, mo, d).getTime();
      if (!Number.isNaN(t)) return t;
    }

    // yyyy-mm-dd
    m = text.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (m) {
      const y = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1, d = parseInt(m[3], 10);
      t = new Date(y, mo, d).getTime();
      if (!Number.isNaN(t)) return t;
    }

    return NaN;
  }

  function getCardDate(row) {
    // 1) hidden input (es. .js-pledge-created / .js-pledge-date)
    const hidden = qs(row, "input.js-pledge-created, input.js-pledge-date, .js-pledge-created, .js-pledge-date");
    if (hidden) {
      const v = hidden.value || hidden.textContent || "";
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    }
    // 2) colonna data visibile
    const dc = qs(row, ".date-col");
    if (dc) {
      const t = parseDateFlexible(dc.textContent.trim());
      if (!Number.isNaN(t)) return t;
    }
    // 3) nessuna data: usa 0 (verrà messo in fondo dopo i datati)
    return 0;
  }

  function sortCardsByDateDesc(nodes) {
    const arr = nodes.map((n, i) => ({
      n,
      t: getCardDate(n),
      // usa ordine originale come tie-break per stabilità
      k: parseInt(n.getAttribute("data-rsipe-page") || "0", 10) * 100000 +
         parseInt(n.getAttribute("data-rsipe-idx") || String(i), 10)
    }));
    arr.sort((a, b) => {
      if (a.t !== b.t) return b.t - a.t; // data discendente
      return a.k - b.k;                  // stabilità
    });
    return arr.map(x => x.n);
  }

  // ---- RICERCA ----
  function extractKeywords(row) {
    const keys = [];
    const h3 = qs(row, ".title-col h3");
    if (h3) keys.push(txt(h3));
    const orig = qs(row, ".js-pledge-name");
    if (orig) keys.push(val(orig));
    const items = qsa(row, ".with-images .item .text");
    for (const t of items) {
      const kind = txt(qs(t, ".kind")).toLowerCase();
      if (kind === "ship") {
        const ttitle = txt(qs(t, ".title"));
        if (ttitle) keys.push(ttitle);
      }
    }
    const upEl = qs(row, ".js-upgrade-data");
    if (upEl) {
      try {
        const data = JSON.parse(upEl.value);
        if (data?.match_items?.[0]?.name) keys.push(data.match_items[0].name);
        if (data?.target_items?.[0]?.name) keys.push(data.target_items[0].name);
        if (data?.name) keys.push(data.name);
      } catch {}
    }
    return keys.join(" | ").toLowerCase();
  }

  function filterCardsByQuery(cards, query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => extractKeywords(c).includes(q));
  }

  // ---- RENDER CARD PAGINA ----
  function renderCardsForPage(cards, pageIndex, pageSize) {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    for (let i = 0; i < cards.length; i++) {
      cards[i].style.display = (i >= start && i < end) ? "" : "none";
    }
  }

  // ---- PAGER RSI-LIKE (una volta; poi update) ----
  const pagerControls = []; // [{ slot, first, prev, next, last, select }]
  function buildPagers(totalPages) {
    if (state.pagerBuilt) return;
    const slots = getPagerSlots();
    if (!slots.length) return;

    const makeUI = (slot) => {
      const container = document.createElement("div");
      container.className = "rsipe-client-pager";
      container.setAttribute("data-rsipe", "pager");

      const first = document.createElement("a");
      first.className = "laquo btn";
      first.href = "#";
      first.innerHTML = '<span class="trans-02s trans-opacity"></span>';

      const prev = document.createElement("a");
      prev.className = "lt btn";
      prev.href = "#";
      prev.innerHTML = '<span class="trans-02s trans-opacity"></span>';

      const select = document.createElement("select");
      select.className = "rsipe-page-select";

      const next = document.createElement("a");
      next.className = "gt btn";
      next.href = "#";
      next.innerHTML = '<span class="trans-02s trans-opacity"></span>';

      const last = document.createElement("a");
      last.className = "raquo btn";
      last.href = "#";
      last.innerHTML = '<span class="trans-02s trans-opacity"></span>';

      function totalPagesNow() { return Math.max(1, Math.ceil(currentFiltered.length / state.pageSize)); }
      function gotoPage(p) {
        const maxIdx = totalPagesNow() - 1;
        const clamped = Math.max(0, Math.min(maxIdx, p));
        if (clamped !== state.page) {
          state.page = clamped;
          renderCardsForPage(currentFiltered, state.page, state.pageSize);
          updatePagers(totalPagesNow());
        }
      }
      const stopAll = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };

      first.addEventListener("click", (e) => { stopAll(e); gotoPage(0); });
      prev.addEventListener("click",  (e) => { stopAll(e); gotoPage(state.page - 1); });
      next.addEventListener("click",  (e) => { stopAll(e); gotoPage(state.page + 1); });
      last.addEventListener("click",  (e) => { stopAll(e); gotoPage(Math.max(0, totalPagesNow() - 1)); });
      select.addEventListener("change", (e) => {
        e.stopImmediatePropagation();
        const v = parseInt(select.value, 10);
        if (!Number.isNaN(v)) gotoPage(v);
      });

      container.append(first, prev, select, next, last);
      slot.innerHTML = "";
      slot.appendChild(container);

      pagerControls.push({ slot, first, prev, next, last, select });
    };

    slots.forEach(makeUI);
    state.pagerBuilt = true;
  }

  function updatePagers(totalPages) {
    pagerControls.forEach(({ first, prev, next, last, select }) => {
      if (select.options.length !== totalPages) {
        select.innerHTML = "";
        for (let i = 0; i < totalPages; i++) {
          const opt = document.createElement("option");
          opt.value = String(i);
          opt.textContent = String(i + 1);
          select.appendChild(opt);
        }
      }
      select.value = String(state.page);
      const atStart = state.page <= 0;
      const atEnd   = state.page >= totalPages - 1;
      [first, prev].forEach(a => a.classList.toggle("disabled", atStart));
      [next,  last].forEach(a => a.classList.toggle("disabled", atEnd));
    });
  }

  function destroyPagers() {
    pagerControls.splice(0).forEach(({ slot }) => { if (slot) slot.innerHTML = ""; });
    state.pagerBuilt = false;
  }

  // ---- PIPELINE PRINCIPALE ----
  async function applyClientPaging() {
    await ensureAllPagesLoaded();

    const allCards = getAllCards();
    // Indice ordine originale se manca (stabilità)
    if (allCards.length && !allCards[0].hasAttribute("data-rsipe-idx")) {
      allCards.forEach((n, i) => n.setAttribute("data-rsipe-idx", String(i)));
    }

    // Filtra per nome (se presente) e ordina per data DESC
    const filtered = filterCardsByQuery(allCards, state.query);
    currentFiltered = sortCardsByDateDesc(filtered);

    state.pageSize = getPageSize();
    const total = currentFiltered.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

    if (state.page > totalPages - 1) state.page = 0;

    // Nascondi tutto, poi mostra solo la pagina corrente
    allCards.forEach((c) => (c.style.display = "none"));
    renderCardsForPage(currentFiltered, state.page, state.pageSize);

    // Rimpiazza i pager nativi con i nostri (una volta), poi solo update
    buildPagers(totalPages);
    updatePagers(totalPages);
  }

  // ---- FLOATING SEARCH PANEL ----
  function ensureFloatPanel() {
    if (qs(null, ".rsipe-float-search")) return;

    const panel = document.createElement("div");
    panel.className = "rsipe-float-search";

    const title = document.createElement("h4");
    title.textContent = "Filter by name";

    const row = document.createElement("div");
    row.className = "rsipe-search-row";

    const input = document.createElement("input");
    input.className = "rsipe-search-input";
    input.type = "text";
    input.placeholder = "e.g. Scorpius, Medivac...";

    const btn = document.createElement("button");
    btn.className = "rsipe-search-btn";
    btn.textContent = "Search";

    row.appendChild(input);
    row.appendChild(btn);
    panel.appendChild(title);
    panel.appendChild(row);
    document.body.appendChild(panel);

    on(btn, "click", async () => {
      state.query = input.value;
      state.page = 0;
      await applyClientPaging();
    });
    on(input, "keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); btn.click(); } });
    on(input, "input", async () => {
      if (input.value.trim() === "" && state.query !== "") {
        state.query = "";
        state.page = 0;
        await applyClientPaging();
      }
    });
  }

  // ---- BOOTSTRAP: pager subito al primo load ----
  function waitForPagerAndCards() {
    return new Promise((resolve) => {
      let tries = 0;
      const check = () => {
        if (document.querySelector(".js-pager .right, .js-pager .left") &&
            document.querySelector(".row.trans-background")) {
          resolve(); return;
        }
        if (tries++ > 180) { resolve(); return; } // ~3s fallback
        requestAnimationFrame(check);
      };
      check();
    });
  }

  // Reagisci a cambi di product-type/pagesize (UI RSI)
  function watchContextChanges() {
    const mo = new MutationObserver(async () => {
      const k = getKey();
      if (k !== state.key) {
        state.key = k;
        state.page = 0;
        loadedPages.clear();
        destroyPagers();
        // rimuovi marker pagina/ordine per evitare conflitti
        getAllCards().forEach(n => { n.removeAttribute("data-rsipe-page"); n.removeAttribute("data-rsipe-idx"); });
        await applyClientPaging();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function init() {
    ensureFloatPanel();
    await waitForPagerAndCards();       // <-- garantisce pager nuovo al primo load
    state.key = getKey();
    await applyClientPaging();          // pager client-side anche senza filtro
    watchContextChanges();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { init(); }, { once: true });
  } else {
    init();
  }
})();
