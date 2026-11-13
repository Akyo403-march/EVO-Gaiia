/** PDF: cartas (slots ±45°) y postales A4 con cantidad por diseño + hoja mixta. */
(function () {
  const carta = { layout: null, files: [] };
  const postal = {
    layoutChica: null,
    layoutGrande: null,
    /** @type {{ size: 'chica'|'grande', name: string, dataUrl: string, img: HTMLImageElement, qty: number }[]} */
    files: [],
  };

  /** @type {{ pages: HTMLCanvasElement[], layout: object, pdfKind: string, index: number } | null} */
  let preview = null;

  function $(id) {
    return document.getElementById(id);
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function dataUrlToBytes(dataUrl) {
    const b64 = dataUrl.split(",")[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function opaqueCentroid(canvas) {
    const ctx = canvas.getContext("2d");
    const { width: w, height: h } = canvas;
    const data = ctx.getImageData(0, 0, w, h).data;
    let sumX = 0;
    let sumY = 0;
    let n = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 128) {
          sumX += x;
          sumY += y;
          n++;
        }
      }
    }
    if (!n) return { cx: w / 2, cy: h / 2 };
    return { cx: sumX / n, cy: sumY / n };
  }

  async function fetchLayout(productId) {
    return fetch(`templates/${productId}/layout.json?v=17`).then((r) => r.json());
  }

  function blockFor(size) {
    const layout = postal.layoutChica || postal.layoutGrande;
    const blocks = layout?.pageBlocks;
    if (blocks && blocks[size]) return blocks[size];
    if (size === "grande") return postal.layoutGrande?.grid;
    return postal.layoutChica?.grid;
  }

  function defaultQty(size) {
    const block = blockFor(size);
    return block?.cols || (size === "grande" ? 7 : 9);
  }

  function clampQty(n) {
    const v = parseInt(n, 10);
    if (!Number.isFinite(v) || v < 1) return 1;
    return Math.min(999, v);
  }

  function totalQty(size) {
    return postal.files
      .filter((f) => f.size === size)
      .reduce((sum, f) => sum + clampQty(f.qty), 0);
  }

  function capacityHint() {
    const blockC = blockFor("chica");
    const blockG = blockFor("grande");
    const capC = (blockC?.rows || 4) * (blockC?.cols || 9);
    const capG = (blockG?.rows || 6) * (blockG?.cols || 7);
    const nC = totalQty("chica");
    const nG = totalQty("grande");
    const pages = Math.max(
      nC ? Math.ceil(nC / capC) : 0,
      nG ? Math.ceil(nG / capG) : 0,
      nC || nG ? 1 : 0
    );
    // Mixed pages: one page takes min(capC, remaining C) and min(capG, remaining G)
    let remC = nC;
    let remG = nG;
    let mixedPages = 0;
    while (remC > 0 || remG > 0) {
      mixedPages++;
      remC = Math.max(0, remC - capC);
      remG = Math.max(0, remG - capG);
    }
    return {
      capC,
      capG,
      nC,
      nG,
      pages: mixedPages || pages,
    };
  }

  function invalidatePreview() {
    preview = null;
    const panel = $("pdfPreviewPanel");
    if (panel && !panel.hidden) closePreview();
  }

  let previewControlsBound = false;

  function bindPreviewControls() {
    if (previewControlsBound) return;
    previewControlsBound = true;
    $("btnPdfPreviewClose").addEventListener("click", closePreview);
    $("btnPdfPreviewPrev").addEventListener("click", () => {
      if (!preview) return;
      showPage(preview.index - 1);
    });
    $("btnPdfPreviewNext").addEventListener("click", () => {
      if (!preview) return;
      showPage(preview.index + 1);
    });
    $("btnPdfPreviewDownload").addEventListener("click", downloadCurrentPreview);
  }

  async function initCarta(layout) {
    carta.layout = layout;
    bindPreviewControls();
    $("btnLoadPiecesCarta").addEventListener("click", () => $("filePiecesCarta").click());
    $("filePiecesCarta").addEventListener("change", async (e) => {
      const list = Array.from(e.target.files || []);
      for (const file of list) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await readFile(file);
        const img = await loadImage(dataUrl);
        carta.files.push({ name: file.name, dataUrl, img });
      }
      e.target.value = "";
      invalidatePreview();
      renderThumbsCarta();
    });
    $("btnClearPiecesCarta").addEventListener("click", () => {
      carta.files = [];
      invalidatePreview();
      renderThumbsCarta();
    });
    $("btnBuildPdfCarta").addEventListener("click", openPreviewCarta);
  }

  async function initPostal() {
    bindPreviewControls();
    postal.layoutChica = await fetchLayout("postal-chica");
    postal.layoutGrande = await fetchLayout("postal-grande");

    $("btnAddPostalChica").addEventListener("click", () =>
      $("filePiecesPostalChica").click()
    );
    $("btnAddPostalGrande").addEventListener("click", () =>
      $("filePiecesPostalGrande").click()
    );
    $("filePiecesPostalChica").addEventListener("change", (e) =>
      onPostalFiles(e, "chica")
    );
    $("filePiecesPostalGrande").addEventListener("change", (e) =>
      onPostalFiles(e, "grande")
    );
    $("btnClearPiecesPostal").addEventListener("click", () => {
      postal.files = [];
      invalidatePreview();
      renderThumbsPostal();
    });
    $("btnBuildPdfPostal").addEventListener("click", openPreviewPostal);
    renderThumbsPostal();
  }

  async function onPostalFiles(e, size) {
    const list = Array.from(e.target.files || []);
    for (const file of list) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await readFile(file);
      const img = await loadImage(dataUrl);
      postal.files.push({
        size,
        name: file.name,
        dataUrl,
        img,
        qty: defaultQty(size),
      });
    }
    e.target.value = "";
    invalidatePreview();
    renderThumbsPostal();
  }

  function renderThumbsCarta() {
    const grid = $("thumbGridCarta");
    grid.innerHTML = "";
    carta.files.forEach((f, i) => {
      const div = document.createElement("div");
      div.className = "thumb";
      div.innerHTML = `<span class="idx">${i + 1}</span><img alt=""><button type="button">Quitar</button>`;
      div.querySelector("img").src = f.dataUrl;
      div.querySelector("button").addEventListener("click", () => {
        carta.files.splice(i, 1);
        invalidatePreview();
        renderThumbsCarta();
      });
      grid.appendChild(div);
    });
    $("btnBuildPdfCarta").disabled = carta.files.length === 0;
    $("assembleHintCarta").textContent =
      carta.files.length === 0
        ? "Carga PNG de cartas (GAIIA-S-…). 2 por hoja."
        : `${carta.files.length} imagen(es) · ${Math.ceil(carta.files.length / 2)} página(s)`;
  }

  function renderThumbsPostal() {
    const grid = $("thumbGridPostal");
    if (!grid) return;
    grid.innerHTML = "";
    postal.files.forEach((f, i) => {
      const div = document.createElement("div");
      div.className = "thumb";
      const label = f.size === "grande" ? "Grande" : "Chica";
      div.innerHTML = `
        <span class="idx">${label}</span>
        <img alt="">
        <div class="qty-row">
          <label for="postalQty${i}">Cantidad</label>
          <input id="postalQty${i}" type="number" min="1" max="999" value="${clampQty(f.qty)}" />
        </div>
        <button type="button">Quitar</button>`;
      div.querySelector("img").src = f.dataUrl;
      const qtyInput = div.querySelector("input");
      qtyInput.addEventListener("change", () => {
        f.qty = clampQty(qtyInput.value);
        qtyInput.value = String(f.qty);
        invalidatePreview();
        updatePostalHint();
      });
      qtyInput.addEventListener("input", () => {
        f.qty = clampQty(qtyInput.value);
        updatePostalHint();
      });
      div.querySelector("button").addEventListener("click", () => {
        postal.files.splice(i, 1);
        invalidatePreview();
        renderThumbsPostal();
      });
      grid.appendChild(div);
    });
    $("btnBuildPdfPostal").disabled = postal.files.length === 0;
    updatePostalHint();
  }

  function updatePostalHint() {
    const hint = $("assembleHintPostal");
    if (!hint) return;
    if (!postal.files.length) {
      hint.textContent =
        "A4 · Cantidad = piezas de cada imagen (p. ej. 9 = 1 fila chica). Calle de corte entre columnas.";
      return;
    }
    const { nC, nG, capC, capG, pages } = capacityHint();
    hint.textContent = `${nC} chica(s) · ${nG} grande(s) · ${pages} página(s) · caben ${capC}+${capG}/hoja`;
  }

  function renderPieceForSlot(img, slot, pieceW, pieceH) {
    const slotScale = slot.scale != null ? slot.scale : 1;
    const fit = Math.min(pieceW / img.naturalWidth, pieceH / img.naturalHeight);
    const dw = Math.max(1, Math.round(img.naturalWidth * fit * slotScale));
    const dh = Math.max(1, Math.round(img.naturalHeight * fit * slotScale));
    const src = document.createElement("canvas");
    src.width = dw;
    src.height = dh;
    src.getContext("2d").drawImage(img, 0, 0, dw, dh);
    const rot = ((slot.rotationDeg || 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rot));
    const sin = Math.abs(Math.sin(rot));
    const rw = Math.ceil(dw * cos + dh * sin);
    const rh = Math.ceil(dw * sin + dh * cos);
    const rotated = document.createElement("canvas");
    rotated.width = Math.max(1, rw);
    rotated.height = Math.max(1, rh);
    const rctx = rotated.getContext("2d");
    rctx.translate(rw / 2, rh / 2);
    rctx.rotate(rot);
    rctx.drawImage(src, -dw / 2, -dh / 2);
    return rotated;
  }

  function renderCartaPage(imgs) {
    const layout = carta.layout;
    const pw = layout.page.widthPx;
    const ph = layout.page.heightPx;
    const canvas = document.createElement("canvas");
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pw, ph);
    const pieceW = layout.piece.widthPx;
    const pieceH = layout.piece.heightPx;
    imgs.forEach((img, s) => {
      if (!img) return;
      const slot = layout.slots[s] || layout.slots[0];
      const rotated = renderPieceForSlot(img, slot, pieceW, pieceH);
      const { cx, cy } = opaqueCentroid(rotated);
      ctx.drawImage(rotated, slot.centerX - cx, slot.centerY - cy);
    });
    return canvas;
  }

  function blankA4Page(layout) {
    const pw = layout.page.widthPx;
    const ph = layout.page.heightPx;
    const canvas = document.createElement("canvas");
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pw, ph);
    return { canvas, ctx };
  }

  function drawInCells(ctx, cells, imgs) {
    const n = Math.min(cells.length, imgs.length);
    for (let i = 0; i < n; i++) {
      const img = imgs[i];
      const cell = cells[i];
      if (!img || !cell) continue;
      const fit = Math.min(cell.w / img.naturalWidth, cell.h / img.naturalHeight);
      const dw = img.naturalWidth * fit;
      const dh = img.naturalHeight * fit;
      const x = cell.x + (cell.w - dw) / 2;
      const y = cell.y + (cell.h - dh) / 2;
      ctx.drawImage(img, x, y, dw, dh);
    }
  }

  /** Expand queue items into individual piece images by qty. */
  function expandPieces(size) {
    const out = [];
    postal.files.forEach((f) => {
      if (f.size !== size) return;
      const q = clampQty(f.qty);
      for (let i = 0; i < q; i++) out.push(f.img);
    });
    return out;
  }

  function buildCartaPages() {
    const pages = [];
    for (let i = 0; i < carta.files.length; i += 2) {
      pages.push(renderCartaPage([carta.files[i]?.img, carta.files[i + 1]?.img]));
    }
    return pages;
  }

  /**
   * Mixed A4 pages (like postales.pdf): chica band top + grande band bottom.
   * Pieces placed cell-by-cell according to each design's quantity.
   */
  function buildPostalPages() {
    const layout = postal.layoutChica || postal.layoutGrande;
    const blockC = blockFor("chica");
    const blockG = blockFor("grande");
    if (!layout || (!blockC && !blockG)) return [];

    let chicas = expandPieces("chica");
    let grandes = expandPieces("grande");
    if (!chicas.length && !grandes.length) return [];

    const capC = blockC ? blockC.cells.length : 0;
    const capG = blockG ? blockG.cells.length : 0;
    const pages = [];

    while (chicas.length || grandes.length) {
      const { canvas, ctx } = blankA4Page(layout);
      if (blockC && chicas.length) {
        const take = chicas.splice(0, capC);
        drawInCells(ctx, blockC.cells, take);
      }
      if (blockG && grandes.length) {
        const take = grandes.splice(0, capG);
        drawInCells(ctx, blockG.cells, take);
      }
      pages.push(canvas);
    }
    return pages;
  }

  async function embedAndDownload(pages, layout, pdfKind) {
    if (!window.PDFLib || !pages.length) return;
    const { PDFDocument } = PDFLib;
    const pdf = await PDFDocument.create();
    for (const pageCanvas of pages) {
      const dataUrl = pageCanvas.toDataURL("image/jpeg", 0.92);
      const embedded = await pdf.embedJpg(dataUrlToBytes(dataUrl));
      const page = pdf.addPage([layout.page.widthPt, layout.page.heightPt]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: layout.page.widthPt,
        height: layout.page.heightPt,
      });
    }
    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = window.EvoNames
      ? EvoNames.nextDownloadName(pdfKind)
      : `GAIIA-${pdfKind}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openPreview(pages, layout, pdfKind) {
    if (!pages.length || !layout) return;
    preview = { pages, layout, pdfKind, index: 0 };
    const panel = $("pdfPreviewPanel");
    panel.hidden = false;
    renderPreviewThumbs();
    showPage(0);
  }

  function closePreview() {
    const panel = $("pdfPreviewPanel");
    if (panel) panel.hidden = true;
    const img = $("pdfPreviewPage");
    if (img) img.removeAttribute("src");
    const thumbs = $("pdfPreviewThumbs");
    if (thumbs) thumbs.innerHTML = "";
  }

  function renderPreviewThumbs() {
    const strip = $("pdfPreviewThumbs");
    strip.innerHTML = "";
    if (!preview) return;
    preview.pages.forEach((canvas, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `Página ${i + 1}`);
      const img = document.createElement("img");
      img.alt = `Página ${i + 1}`;
      img.src = canvas.toDataURL("image/jpeg", 0.72);
      btn.appendChild(img);
      btn.addEventListener("click", () => showPage(i));
      strip.appendChild(btn);
    });
  }

  function showPage(index) {
    if (!preview || !preview.pages.length) return;
    const max = preview.pages.length - 1;
    const i = Math.max(0, Math.min(max, index));
    preview.index = i;
    const canvas = preview.pages[i];
    $("pdfPreviewPage").src = canvas.toDataURL("image/jpeg", 0.85);
    $("pdfPreviewHint").textContent = `Página ${i + 1} de ${preview.pages.length}`;
    $("btnPdfPreviewPrev").disabled = i <= 0;
    $("btnPdfPreviewNext").disabled = i >= max;
    const strip = $("pdfPreviewThumbs");
    Array.from(strip.children).forEach((btn, n) => {
      btn.classList.toggle("active", n === i);
    });
  }

  async function downloadCurrentPreview() {
    if (!preview || !preview.pages.length) return;
    const btn = $("btnPdfPreviewDownload");
    if (btn) btn.disabled = true;
    try {
      await embedAndDownload(preview.pages, preview.layout, preview.pdfKind);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function openPreviewCarta() {
    if (!carta.files.length) return;
    const pages = buildCartaPages();
    openPreview(pages, carta.layout, "PDF-S");
  }

  function openPreviewPostal() {
    if (!postal.files.length) return;
    const pages = buildPostalPages();
    if (!pages.length) return;
    const pageLayout = postal.layoutChica || postal.layoutGrande;
    openPreview(pages, pageLayout, "PDF-P");
  }

  window.EvoPdf = {
    initCarta,
    initPostal,
  };
})();
