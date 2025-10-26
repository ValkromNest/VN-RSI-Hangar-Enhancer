// ==============================
// RSI Pledges — Card Enhancer
// ==============================
(function() {
  "use strict";

  const MONEY_RE = /\$?\s*([\d,]+(?:\.\d{2})?)/;
  const qs = (el, sel) => el?.querySelector(sel) || null;
  const qsa = (el, sel) => Array.from((el || document).querySelectorAll(sel));
  const txt = (el) => (el?.textContent || "").trim();
  const val = (el) => (el?.value || "").trim();
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
    // fallback minimale
    const contains = qs(row, ".items-col");
    if (contains) {
      const label = qs(contains, "label");
      const s = txt(contains).replace(new RegExp(`^${label ? label.textContent.trim() : "Contains:"}\\s*`, "i"), "");
      return s.split(/ and /i)[0].trim();
    }
    return null;
  }

  function getShipImageUrl(row) {
    const shipItem = qsa(row, ".with-images .item").find(item => {
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
    if (list.some(x => /lifetime/i.test(x))) return "Lifetime Insurance";
    const months = list
      .map(x => {
        const m = x.match(/(\d+)\s*Month/i);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter(Boolean)
      .sort((a,b) => b-a);
    if (months.length) return `${months[0]} Month Insurance`;
    return "—";
  }

  function addItemsColLike(row, labelText, valueText, key) {
    const wrapper = qs(row, ".wrapper-col");
    if (!wrapper) return;

    // Evita duplicati
    const existing = qs(wrapper, `.items-col[data-rsipe='${key}']`);
    if (existing) return;

    // Struttura nativa RSI: label + text node sulla stessa riga
    const div = document.createElement("div");
    div.className = "items-col";
    div.setAttribute("data-rsipe", key);

    const label = document.createElement("label");
    label.textContent = labelText;
    div.appendChild(label);
    div.appendChild(document.createTextNode(" " + valueText));

    // Inserisci subito dopo l’ultimo .items-col, altrimenti dopo .date-col
    const itemsCols = qsa(wrapper, ".items-col");
    if (itemsCols.length) {
      itemsCols[itemsCols.length - 1].insertAdjacentElement("afterend", div);
    } else {
      const dateCol = qs(wrapper, ".date-col");
      if (dateCol) {
        dateCol.insertAdjacentElement("afterend", div);
      } else {
        wrapper.appendChild(div);
      }
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
            sub.textContent = `Origin: ${original}`;
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
    addItemsColLike(row, "Insurance:", ins, "insurance");
  }

  function scan() {
    qsa(document, ".row.trans-background").forEach(processRow);
  }

  const mo = new MutationObserver(() => scan());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  scan();
})();


// =======================================================================
// RSI Pledges — Floating Search (global, robust) + client pager on-demand
// =======================================================================
(function() {
  "use strict";

  // --- Utils ---
  const qs = (el, sel) => (el ? el.querySelector(sel) : document.querySelector(sel));
  const qsa = (el, sel) => (el ? Array.from(el.querySelectorAll(sel)) : Array.from(document.querySelectorAll(sel)));
  const txt = (el) => (el && el.textContent ? el.textContent.trim() : "");
  const val = (el) => (el && typeof el.value === "string" ? el.value.trim() : ""); // <-- FIX
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // Stato
  let state = { query: "", page: 0, pageSize: 10, bootstrapped: false };

  // Pager originale
  let originalPagerHTML = null;
  function getPagerRight() { return qs(null, ".js-pager .right"); }
  function cacheOriginalPager() {
    const right = getPagerRight();
    if (right && originalPagerHTML === null) originalPagerHTML = right.innerHTML;
  }
  function restoreOriginalPager() {
    const right = getPagerRight();
    if (right && originalPagerHTML !== null) right.innerHTML = originalPagerHTML;
  }

  // Letture base
  function getAllCards() { return qsa(null, ".row.trans-background"); }

  // Indicizzazione: titolo card, hidden name, ship negli items, upgrade from/to
  function extractKeywords(row) {
    const keys = [];

    const h3 = qs(row, ".title-col h3");
    if (h3) keys.push(txt(h3));

    const orig = qs(row, ".js-pledge-name");
    if (orig) keys.push(val(orig)); // <-- FIX: usa val locale

    // ship negli Items
    const items = qsa(row, ".with-images .item .text");
    for (const t of items) {
      const kind = txt(qs(t, ".kind")).toLowerCase();
      if (kind === "ship") {
        const ttitle = txt(qs(t, ".title"));
        if (ttitle) keys.push(ttitle);
      }
    }

    // upgrade from/to
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

  // Pager helpers
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
    const pages = links.map(a => {
      const href = a.getAttribute("href") || "";
      const m = href.match(/page=(\d+)/i);
      return m ? parseInt(m[1], 10) : NaN;
    }).filter(Number.isFinite);
    return pages.length ? Math.max(...pages) : 1;
  }
  function getCurrentPageFromPager() {
    const a = getActivePagerLink();
    const href = a ? a.getAttribute("href") || "" : location.search;
    const m = href.match(/page=(\d+)/i);
    return m ? parseInt(m[1], 10) : 1;
  }
  function getRowsContainer() {
    const first = qs(null, ".row.trans-background");
    return first ? first.parentElement : null;
  }

  // Caricamento sottopagine con anti-duplica
  const loadedPages = new Set();
  async function ensureAllPagesLoaded() {
    const totalPages = getTotalPagesFromPager();
    const currPage = getCurrentPageFromPager();
    const container = getRowsContainer();
    if (!container) return;

    if (!loadedPages.has(currPage)) {
      getAllCards().forEach(n => { if (!n.hasAttribute("data-rsipe-page")) n.setAttribute("data-rsipe-page", String(currPage)); });
      loadedPages.add(currPage);
    }

    for (let p = 1; p <= totalPages; p++) {
      if (loadedPages.has(p)) continue;
      try {
        const u = new URL(location.href);
        u.searchParams.set("page", String(p));
        const html = await fetch(u.href, { credentials: "same-origin" }).then(r => r.text());
        const doc = new DOMParser().parseFromString(html, "text/html");
        const rows = Array.from(doc.querySelectorAll(".row.trans-background"));
        rows.forEach(row => {
          const imported = document.importNode(row, true);
          imported.style.display = "none";
          imported.setAttribute("data-rsipe-page", String(p));
          container.appendChild(imported);
        });
        loadedPages.add(p);
      } catch (e) {
        console.warn("[RSI Enhancer] fetch page failed", p, e);
      }
    }
  }

  // Filtro + client pager (mostrato solo se >1 pagina di risultati)
  function filterCardsByQuery(cards, query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(c => extractKeywords(c).includes(q));
  }
  function renderCardsForPage(cards, pageIndex, pageSize) {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    for (let i = 0; i < cards.length; i++) {
      const show = i >= start && i < end;
      cards[i].style.display = show ? "" : "none";
    }
  }
  function renderClientPager(total, pageSize, currentPage, onGoto) {
    const right = getPagerRight();
    if (!right) return;

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) { right.innerHTML = ""; return; }

    const container = document.createElement("div");
    container.className = "rsipe-client-pager";
    for (let p = 0; p < totalPages; p++) {
      const el = document.createElement(p === currentPage ? "span" : "a");
      el.textContent = String(p + 1);
      if (p === currentPage) {
        el.className = "active";
      } else {
        el.href = "#";
        on(el, "click", (e) => { e.preventDefault(); onGoto(p); });
      }
      container.appendChild(el);
    }
    right.innerHTML = "";
    right.appendChild(container);
  }

  async function applySearchAndPaginateGlobal() {
    try {
      await ensureAllPagesLoaded();

      const allCards = getAllCards();
      const filtered = filterCardsByQuery(allCards, state.query);

      state.pageSize = getPageSize();
      const total = filtered.length;
      const maxPageIndex = Math.max(0, Math.ceil(total / state.pageSize) - 1);
      if (state.page > maxPageIndex) state.page = 0;

      allCards.forEach(c => c.style.display = "none");
      renderCardsForPage(filtered, state.page, state.pageSize);

      cacheOriginalPager();
      renderClientPager(total, state.pageSize, state.page, (newPage) => {
        state.page = newPage;
        renderCardsForPage(filtered, state.page, state.pageSize);
      });
    } catch (e) {
      // fallback in caso di errore inatteso
      console.warn("[RSI Enhancer] search error:", e);
      const all = getAllCards();
      all.forEach(c => c.style.display = "");
      restoreOriginalPager();
    }
  }

  // Pannello flottante (senza testo status)
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
      if (state.query.trim() === "") {
        const all = getAllCards();
        for (const c of all) c.style.display = "";
        restoreOriginalPager();
        return;
      }
      await applySearchAndPaginateGlobal();
    });

    on(input, "keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btn.click();
      }
    });

    on(input, "input", () => {
      if (input.value.trim() === "" && state.query !== "") {
        state.query = "";
        state.page = 0;
        const all = getAllCards();
        for (const c of all) c.style.display = "";
        restoreOriginalPager();
      }
    });
  }

  // Bootstrap
  function init() { ensureFloatPanel(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

