/** Editor multi-producto: carta (logo) / postal (recuadro); cyan fuera + magenta cobertura. */
(function () {
  const FONTS = [
    { id: "IBM Plex Sans", label: "IBM Plex Sans" },
    { id: "IBM Plex Serif", label: "IBM Plex Serif" },
    { id: "Jost", label: "Jost (Futura)" },
    { id: "Caveat", label: "Caveat" },
    { id: "Dancing Script", label: "Dancing Script" },
  ];

  const HANDLE = 32;

  const state = {
    productId: "sobre",
    templatePath: "templates/sobre",
    layout: null,
    mask: null,
    frameImg: null,
    photo: null,
    logoBlack: null,
    logoWhite: null,
    scaleX: 1,
    scaleY: 1,
    rotationDeg: 0,
    lockAspect: true,
    ox: 0,
    oy: 0,
    texts: [],
    selectedText: -1,
    logoOn: false,
    logoMode: "black",
    logoX: 0,
    logoY: 0,
    logoW: 0,
    logoH: 0,
    frameOn: false,
    drag: null,
    uiBound: false,
  };

  let canvas;
  let ctx;
  let measureCtx;

  function $(id) {
    return document.getElementById(id);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo cargar: " + src));
      img.src = src;
    });
  }

  function features() {
    return state.layout.features || { logo: true, frame: false, text: true };
  }

  function isPostal() {
    return (state.layout.kind || "") === "postal";
  }

  async function init() {
    canvas = $("editCanvas");
    ctx = canvas.getContext("2d", { alpha: true });
    measureCtx = document.createElement("canvas").getContext("2d");
    state.logoBlack = await loadImage("assets/logo-black.png");
    state.logoWhite = await loadImage("assets/logo-white.png");
    fillFontSelect();
    bindUi();
    window.addEventListener("resize", () => {
      if (!state.layout) return;
      resizeCanvas();
      render();
    });
  }

  async function loadProduct(productId) {
    const path = `templates/${productId}`;
    const layout = await fetch(`${path}/layout.json?v=13`).then((r) => r.json());
    state.productId = productId;
    state.templatePath = path;
    state.layout = layout;

    const piece = layout.piece;
    const maskName = piece.mask || "mask-alpha.png";
    state.mask = await loadImage(`${path}/${maskName}?v=10`);

    if (features().frame && piece.frame) {
      state.frameImg = await loadImage(`${path}/${piece.frame}?v=10`);
    } else {
      state.frameImg = null;
    }

    if (features().logo && layout.logo) {
      state.logoW = layout.logo.widthPx;
      const aspect = state.logoBlack.naturalHeight / state.logoBlack.naturalWidth;
      state.logoH = Math.round(state.logoW * aspect);
    }

    clearEditor(false);
    syncProductUi();
    syncAspectModeUi();
    resizeCanvas();
    render();
    return layout;
  }

  function syncProductUi() {
    const postal = isPostal();
    document.querySelectorAll(".carta-only").forEach((el) => {
      el.hidden = postal;
    });
    document.querySelectorAll(".postal-only").forEach((el) => {
      el.hidden = !postal;
    });
    const badge = $("productBadge");
    if (badge) {
      badge.hidden = postal;
      badge.textContent = state.layout.name || state.productId;
    }
    const modeLabel = $("postalModeLabel");
    const sizeBtn = $("btnPostalSize");
    if (postal) {
      const isGrande = state.productId === "postal-grande";
      if (modeLabel) {
        modeLabel.textContent = isGrande
          ? "Trabajando: Postal grande"
          : "Trabajando: Postal chica";
      }
      if (sizeBtn) {
        sizeBtn.textContent = isGrande ? "Cambiar a chica" : "Cambiar a grande";
      }
    }
    const frameBtn = $("btnFrame");
    if (frameBtn) {
      frameBtn.classList.toggle("btn-primary", state.frameOn);
      frameBtn.textContent = state.frameOn ? "Recuadro: ON" : "Recuadro";
    }
    const side = $("sideHintProduct");
    if (side) {
      side.textContent = postal
        ? "El badge indica el tamaño actual. El botón cambia al otro. Recuadro opcional."
        : "Logo GAIIA arrastrable. Simétrico / Deformar y rotación abajo.";
    }
  }

  function fillFontSelect() {
    const sel = $("fontSelect");
    sel.innerHTML = "";
    FONTS.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.label;
      sel.appendChild(opt);
    });
  }

  /** Logical pad around piece (piece px) so cyan shows outside the crop. */
  function viewPad() {
    if (!state.layout) return 0;
    const pw = state.layout.piece.widthPx;
    const ph = state.layout.piece.heightPx;
    return Math.max(48, Math.round(Math.max(pw, ph) * 0.14));
  }

  function viewSize() {
    const pw = state.layout.piece.widthPx;
    const ph = state.layout.piece.heightPx;
    const pad = viewPad();
    return { vw: pw + pad * 2, vh: ph + pad * 2, pad, pw, ph };
  }

  function resizeCanvas() {
    if (!state.layout) return;
    const wrap = canvas.parentElement;
    const main = wrap && wrap.parentElement;
    const { vw, vh } = viewSize();
    const ratio = vh / vw;

    let availW = (main && main.clientWidth) || wrap.clientWidth || 0;
    let availH = (main && main.clientHeight) || 0;
    if (availW < 120) availW = Math.min(window.innerWidth - 24, 900);
    if (availH < 120) availH = Math.max(280, window.innerHeight - 220);

    let cssW = availW - 16;
    let cssH = cssW * ratio;
    if (cssH > availH - 16) {
      cssH = availH - 16;
      cssW = cssH / ratio;
    }
    cssW = Math.max(220, Math.floor(cssW));
    cssH = Math.max(220, Math.floor(cssH));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    wrap.style.width = `${cssW}px`;
    wrap.style.height = `${cssH}px`;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  function viewScale() {
    const { vw } = viewSize();
    return canvas.width / vw;
  }

  function pieceFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const { vw, vh, pad } = viewSize();
    const vx = ((clientX - rect.left) / rect.width) * vw;
    const vy = ((clientY - rect.top) / rect.height) * vh;
    return { x: vx - pad, y: vy - pad };
  }

  function baseCoverScale() {
    if (!state.photo) return 1;
    const pw = state.layout.piece.widthPx;
    const ph = state.layout.piece.heightPx;
    const iw = state.photo.naturalWidth;
    const ih = state.photo.naturalHeight;
    return Math.max(pw / iw, ph / ih) * 1.02;
  }

  function photoSize() {
    if (!state.photo) return { w: 0, h: 0 };
    return {
      w: state.photo.naturalWidth * state.scaleX,
      h: state.photo.naturalHeight * state.scaleY,
    };
  }

  function photoCenter() {
    const { w, h } = photoSize();
    return { cx: state.ox + w / 2, cy: state.oy + h / 2 };
  }

  function photoCorners() {
    const { w, h } = photoSize();
    const { cx, cy } = photoCenter();
    const rad = (state.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const local = [
      { id: "nw", lx: -w / 2, ly: -h / 2 },
      { id: "ne", lx: w / 2, ly: -h / 2 },
      { id: "sw", lx: -w / 2, ly: h / 2 },
      { id: "se", lx: w / 2, ly: h / 2 },
    ];
    return local.map((p) => ({
      id: p.id,
      x: cx + p.lx * cos - p.ly * sin,
      y: cy + p.lx * sin + p.ly * cos,
    }));
  }

  function drawPhotoOn(c) {
    if (!state.photo) return;
    const { w, h } = photoSize();
    const { cx, cy } = photoCenter();
    c.save();
    c.translate(cx, cy);
    c.rotate((state.rotationDeg * Math.PI) / 180);
    c.drawImage(state.photo, -w / 2, -h / 2, w, h);
    c.restore();
  }

  function coverFit() {
    if (!state.photo) return;
    const base = baseCoverScale();
    state.scaleX = base;
    state.scaleY = base;
    state.rotationDeg = 0;
    const pw = state.layout.piece.widthPx;
    const ph = state.layout.piece.heightPx;
    const { w, h } = photoSize();
    state.ox = (pw - w) / 2;
    state.oy = (ph - h) / 2;
    syncTransformControls();
  }

  function drawTextOn(c, t) {
    c.font = `${t.bold ? "700" : "400"} ${t.size}px "${t.font}"`;
    c.fillStyle = t.color;
    c.textBaseline = "alphabetic";
    c.fillText(t.text || "", t.x, t.y);
  }

  function measureText(t) {
    measureCtx.font = `${t.bold ? "700" : "400"} ${t.size}px "${t.font}"`;
    return { w: measureCtx.measureText(t.text || " ").width, h: t.size };
  }

  function resetLogoPosition() {
    if (!state.layout || !state.layout.logo) return;
    const piece = state.layout.piece;
    const logoCfg = state.layout.logo;
    state.logoX = (piece.widthPx - state.logoW) / 2;
    state.logoY = piece.heightPx - state.logoH - (logoCfg.offsetYPx || 0);
  }

  function buildExportLayer() {
    const pw = state.layout.piece.widthPx;
    const ph = state.layout.piece.heightPx;
    const layer = document.createElement("canvas");
    layer.width = pw;
    layer.height = ph;
    const lctx = layer.getContext("2d");

    drawPhotoOn(lctx);
    state.texts.forEach((t) => drawTextOn(lctx, t));
    if (features().logo && state.logoOn) {
      const logo = state.logoMode === "white" ? state.logoWhite : state.logoBlack;
      lctx.drawImage(logo, state.logoX, state.logoY, state.logoW, state.logoH);
    }

    lctx.globalCompositeOperation = "destination-in";
    lctx.drawImage(state.mask, 0, 0, pw, ph);
    lctx.globalCompositeOperation = "source-over";

    if (features().frame && state.frameOn && state.frameImg) {
      lctx.drawImage(state.frameImg, 0, 0, pw, ph);
    }
    return layer;
  }

  function render() {
    if (!state.layout || !state.mask) return;
    const { vw, vh, pad, pw, ph } = viewSize();
    const s = viewScale();
    const cyan = state.layout.previewOverlay || "#00FFFF";
    const magenta = state.layout.coverageUnderlay || "#FF00AA";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // Full view cyan (padding around piece)
    ctx.fillStyle = cyan;
    ctx.fillRect(0, 0, vw, vh);

    // Draw piece content offset by pad
    ctx.save();
    ctx.translate(pad, pad);

    if (state.photo) {
      // Magenta underlay only inside the crop hole
      const cov = document.createElement("canvas");
      cov.width = pw;
      cov.height = ph;
      const cctx = cov.getContext("2d");
      cctx.fillStyle = magenta;
      cctx.fillRect(0, 0, pw, ph);
      cctx.globalCompositeOperation = "destination-in";
      cctx.drawImage(state.mask, 0, 0, pw, ph);
      ctx.drawImage(cov, 0, 0);

      // Photo visible only inside the mask — never spills over cyan
      const photoLayer = document.createElement("canvas");
      photoLayer.width = pw;
      photoLayer.height = ph;
      const pctx = photoLayer.getContext("2d");
      drawPhotoOn(pctx);
      pctx.globalCompositeOperation = "destination-in";
      pctx.drawImage(state.mask, 0, 0, pw, ph);
      ctx.drawImage(photoLayer, 0, 0);
    } else {
      ctx.fillStyle = "rgba(20,20,20,0.85)";
      ctx.fillRect(0, 0, pw, ph);
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${Math.round(pw * 0.045)}px "IBM Plex Sans"`;
      ctx.textAlign = "center";
      ctx.fillText("Elige una imagen", pw / 2, ph / 2);
      ctx.textAlign = "start";
    }

    // Text / logo drawn then covered by cyan outside the crop
    state.texts.forEach((t) => drawTextOn(ctx, t));
    if (features().logo && state.logoOn) {
      const logo = state.logoMode === "white" ? state.logoWhite : state.logoBlack;
      ctx.drawImage(logo, state.logoX, state.logoY, state.logoW, state.logoH);
    }

    const overlay = document.createElement("canvas");
    overlay.width = pw;
    overlay.height = ph;
    const octx = overlay.getContext("2d");
    octx.fillStyle = cyan;
    octx.fillRect(0, 0, pw, ph);
    octx.globalCompositeOperation = "destination-out";
    octx.drawImage(state.mask, 0, 0, pw, ph);
    ctx.drawImage(overlay, 0, 0);

    if (features().frame && state.frameOn && state.frameImg) {
      ctx.drawImage(state.frameImg, 0, 0, pw, ph);
    }

    if (state.photo) {
      const corners = photoCorners();
      const { cx, cy } = photoCenter();
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2 / s;
      ctx.setLineDash([10 / s, 8 / s]);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      const hs = Math.max(HANDLE, 22 / s);
      corners.forEach((h) => {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2 / s;
        ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
      });
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(cx, cy, 4 / s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (state.selectedText >= 0 && state.texts[state.selectedText]) {
      const t = state.texts[state.selectedText];
      const m = measureText(t);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 / s;
      ctx.setLineDash([8 / s, 6 / s]);
      ctx.strokeRect(t.x - 6, t.y - m.h - 6, m.w + 12, m.h + 12);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function exportPng() {
    const layer = buildExportLayer();
    const kind = window.EvoNames
      ? EvoNames.kindForProduct(state.productId)
      : "S";
    const filename = window.EvoNames
      ? EvoNames.nextDownloadName(kind)
      : `GAIIA-${kind}.png`;
    layer.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  function hitHandle(p) {
    if (!state.photo) return null;
    const hs = Math.max(HANDLE, 28);
    for (const h of photoCorners()) {
      if (Math.abs(p.x - h.x) <= hs / 2 && Math.abs(p.y - h.y) <= hs / 2) return h.id;
    }
    return null;
  }

  function hitTest(p) {
    const handle = hitHandle(p);
    if (handle) return { type: "handle", id: handle };

    if (features().logo && state.logoOn) {
      if (
        p.x >= state.logoX &&
        p.x <= state.logoX + state.logoW &&
        p.y >= state.logoY &&
        p.y <= state.logoY + state.logoH
      ) {
        return { type: "logo" };
      }
    }
    for (let i = state.texts.length - 1; i >= 0; i--) {
      const t = state.texts[i];
      const m = measureText(t);
      if (p.x >= t.x - 4 && p.x <= t.x + m.w + 4 && p.y >= t.y - m.h - 4 && p.y <= t.y + 8) {
        return { type: "text", index: i };
      }
    }
    return { type: "photo" };
  }

  function syncTextFields() {
    const t = state.texts[state.selectedText];
    if (!t) {
      $("textContent").value = "";
      return;
    }
    $("textContent").value = t.text;
    $("fontSelect").value = t.font;
    $("fontSize").value = String(t.size);
    $("textColor").value = t.color;
    $("textBold").checked = !!t.bold;
  }

  function clampScale(v) {
    return Math.max(0.05, Math.min(8, v));
  }

  function syncTransformControls() {
    if (!state.photo) return;
    const base = baseCoverScale();
    const widthPct = Math.round((state.scaleX / base) * 100);
    const heightPct = Math.round((state.scaleY / base) * 100);
    if ($("widthRange")) $("widthRange").value = String(Math.min(300, Math.max(25, widthPct)));
    if ($("heightRange")) $("heightRange").value = String(Math.min(300, Math.max(25, heightPct)));
    if ($("widthValue")) $("widthValue").value = String(Math.min(300, Math.max(25, widthPct)));
    if ($("heightValue")) $("heightValue").value = String(Math.min(300, Math.max(25, heightPct)));
    if ($("rotationRange")) $("rotationRange").value = String(state.rotationDeg);
    if ($("rotationValue")) $("rotationValue").value = String(Math.round(state.rotationDeg));
  }

  function setScaleFromPercent(axis, pct) {
    if (!state.photo) return;
    const base = baseCoverScale();
    const next = clampScale(base * (pct / 100));
    const { cx, cy } = photoCenter();
    if (state.lockAspect || axis === "both") {
      state.scaleX = next;
      state.scaleY = next;
    } else if (axis === "x") {
      state.scaleX = next;
    } else {
      state.scaleY = next;
    }
    const { w, h } = photoSize();
    state.ox = cx - w / 2;
    state.oy = cy - h / 2;
    syncTransformControls();
  }

  function setRotation(deg) {
    const { cx, cy } = photoCenter();
    state.rotationDeg = Math.max(-180, Math.min(180, deg));
    const { w, h } = photoSize();
    state.ox = cx - w / 2;
    state.oy = cy - h / 2;
    syncTransformControls();
  }

  function syncAspectModeUi() {
    const sym = $("btnSymetric");
    const def = $("btnDeform");
    if (sym) sym.classList.toggle("btn-primary", state.lockAspect);
    if (def) def.classList.toggle("btn-primary", !state.lockAspect);
    if ($("heightRange")) $("heightRange").disabled = state.lockAspect;
    if ($("heightValue")) $("heightValue").disabled = state.lockAspect;
  }

  function clearEditor(doRender) {
    state.photo = null;
    state.scaleX = 1;
    state.scaleY = 1;
    state.rotationDeg = 0;
    state.lockAspect = true;
    state.ox = 0;
    state.oy = 0;
    state.texts = [];
    state.selectedText = -1;
    state.logoOn = false;
    state.logoMode = "black";
    state.frameOn = false;
    state.drag = null;
    resetLogoPosition();

    if ($("fileImage")) $("fileImage").value = "";
    if ($("btnChooseImage")) $("btnChooseImage").textContent = "Elegir imagen";
    if ($("editStatus")) $("editStatus").textContent = "Sin imagen";
    if ($("btnLogo")) {
      $("btnLogo").classList.remove("btn-primary");
      $("btnLogo").textContent = "Logo";
    }
    if ($("logoMode")) $("logoMode").value = "black";
    if ($("btnFrame")) {
      $("btnFrame").classList.remove("btn-primary");
      $("btnFrame").textContent = "Recuadro";
    }
    syncTextFields();
    syncAspectModeUi();
    if ($("widthRange")) $("widthRange").value = "100";
    if ($("heightRange")) $("heightRange").value = "100";
    if ($("widthValue")) $("widthValue").value = "100";
    if ($("heightValue")) $("heightValue").value = "100";
    if ($("rotationRange")) $("rotationRange").value = "0";
    if ($("rotationValue")) $("rotationValue").value = "0";
    if (doRender !== false) render();
  }

  function bindUi() {
    if (state.uiBound) return;
    state.uiBound = true;

    $("btnChooseImage").addEventListener("click", () => $("fileImage").click());
    $("fileImage").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        state.photo = await loadImage(url);
        coverFit();
        $("btnChooseImage").textContent = "Cambiar imagen";
        if ($("editStatus")) {
          $("editStatus").textContent = `${file.name} · ${state.photo.naturalWidth}×${state.photo.naturalHeight}`;
        }
        render();
      } catch (err) {
        alert("No se pudo abrir la imagen. Prueba JPG o PNG.");
        console.error(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    });

    $("btnAddText").addEventListener("click", () => {
      const piece = state.layout.piece;
      state.texts.push({
        text: "Tu texto",
        x: piece.widthPx * 0.22,
        y: piece.heightPx * 0.42,
        size: Math.max(24, Math.round(piece.widthPx * 0.07)),
        font: $("fontSelect").value || "IBM Plex Sans",
        color: $("textColor").value || "#ffffff",
        bold: $("textBold").checked,
      });
      state.selectedText = state.texts.length - 1;
      syncTextFields();
      render();
    });

    $("btnDeleteText").addEventListener("click", () => {
      if (state.selectedText < 0) return;
      state.texts.splice(state.selectedText, 1);
      state.selectedText = -1;
      syncTextFields();
      render();
    });

    ["textContent", "fontSelect", "fontSize", "textColor", "textBold"].forEach((id) => {
      $(id).addEventListener("input", () => {
        if (state.selectedText < 0) return;
        const t = state.texts[state.selectedText];
        t.text = $("textContent").value;
        t.font = $("fontSelect").value;
        t.size = Number($("fontSize").value) || 48;
        t.color = $("textColor").value;
        t.bold = $("textBold").checked;
        render();
      });
    });

    $("btnLogo").addEventListener("click", () => {
      if (!features().logo) return;
      state.logoOn = !state.logoOn;
      $("btnLogo").classList.toggle("btn-primary", state.logoOn);
      $("btnLogo").textContent = state.logoOn ? "Logo: ON" : "Logo";
      render();
    });

    $("logoMode").addEventListener("change", () => {
      state.logoMode = $("logoMode").value;
      render();
    });

    $("btnFrame").addEventListener("click", () => {
      if (!features().frame) return;
      state.frameOn = !state.frameOn;
      $("btnFrame").classList.toggle("btn-primary", state.frameOn);
      $("btnFrame").textContent = state.frameOn ? "Recuadro: ON" : "Recuadro";
      render();
    });

    $("btnPostalSize").addEventListener("click", async () => {
      const next =
        state.productId === "postal-chica" ? "postal-grande" : "postal-chica";
      await loadProduct(next);
      if (window.EvoApp && typeof EvoApp.onProductChanged === "function") {
        EvoApp.onProductChanged(next);
      }
    });

    $("btnExportPng").addEventListener("click", exportPng);
    $("btnClearEditor").addEventListener("click", () => clearEditor(true));

    $("btnSymetric").addEventListener("click", () => {
      state.lockAspect = true;
      state.scaleY = state.scaleX;
      const { cx, cy } = photoCenter();
      const { w, h } = photoSize();
      state.ox = cx - w / 2;
      state.oy = cy - h / 2;
      syncAspectModeUi();
      syncTransformControls();
      render();
    });

    $("btnDeform").addEventListener("click", () => {
      state.lockAspect = false;
      syncAspectModeUi();
      render();
    });

    $("widthRange").addEventListener("input", () => {
      setScaleFromPercent(state.lockAspect ? "both" : "x", Number($("widthRange").value) || 100);
      render();
    });
    $("widthValue").addEventListener("change", () => {
      setScaleFromPercent(state.lockAspect ? "both" : "x", Number($("widthValue").value) || 100);
      render();
    });
    $("heightRange").addEventListener("input", () => {
      setScaleFromPercent(state.lockAspect ? "both" : "y", Number($("heightRange").value) || 100);
      render();
    });
    $("heightValue").addEventListener("change", () => {
      setScaleFromPercent(state.lockAspect ? "both" : "y", Number($("heightValue").value) || 100);
      render();
    });
    $("rotationRange").addEventListener("input", () => {
      setRotation(Number($("rotationRange").value) || 0);
      render();
    });
    $("rotationValue").addEventListener("change", () => {
      setRotation(Number($("rotationValue").value) || 0);
      render();
    });

    function onDown(e) {
      e.preventDefault();
      const p = pieceFromEvent(e);
      const hit = hitTest(p);
      if (hit.type === "handle") {
        const { cx, cy } = photoCenter();
        state.drag = {
          type: "handle",
          id: hit.id,
          start: p,
          scaleX: state.scaleX,
          scaleY: state.scaleY,
          cx,
          cy,
        };
      } else if (hit.type === "text") {
        state.selectedText = hit.index;
        syncTextFields();
        state.drag = {
          type: "text",
          index: hit.index,
          dx: p.x - state.texts[hit.index].x,
          dy: p.y - state.texts[hit.index].y,
        };
      } else if (hit.type === "logo") {
        state.selectedText = -1;
        state.drag = { type: "logo", dx: p.x - state.logoX, dy: p.y - state.logoY };
      } else {
        state.selectedText = -1;
        state.drag = { type: "photo", x: p.x, y: p.y, ox: state.ox, oy: state.oy };
      }
      canvas.classList.add("dragging");
      render();
    }

    function onMove(e) {
      if (!state.drag) return;
      e.preventDefault();
      const p = pieceFromEvent(e);
      if (state.drag.type === "photo" && state.photo) {
        state.ox = state.drag.ox + (p.x - state.drag.x);
        state.oy = state.drag.oy + (p.y - state.drag.y);
      } else if (state.drag.type === "handle" && state.photo) {
        const cx = state.drag.cx;
        const cy = state.drag.cy;
        const d0 = Math.hypot(state.drag.start.x - cx, state.drag.start.y - cy) || 1;
        const d1 = Math.hypot(p.x - cx, p.y - cy);
        const factor = Math.max(0.15, Math.min(6, d1 / d0));
        if (state.lockAspect) {
          state.scaleX = clampScale(state.drag.scaleX * factor);
          state.scaleY = clampScale(state.drag.scaleY * factor);
        } else {
          const rad = (state.rotationDeg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const lx = (p.x - cx) * cos + (p.y - cy) * sin;
          const ly = -(p.x - cx) * sin + (p.y - cy) * cos;
          state.scaleX = clampScale((Math.abs(lx) * 2) / state.photo.naturalWidth);
          state.scaleY = clampScale((Math.abs(ly) * 2) / state.photo.naturalHeight);
        }
        const { w, h } = photoSize();
        state.ox = cx - w / 2;
        state.oy = cy - h / 2;
        syncTransformControls();
      } else if (state.drag.type === "text") {
        const t = state.texts[state.drag.index];
        t.x = p.x - state.drag.dx;
        t.y = p.y - state.drag.dy;
      } else if (state.drag.type === "logo") {
        state.logoX = p.x - state.drag.dx;
        state.logoY = p.y - state.drag.dy;
      }
      render();
    }

    function onUp() {
      state.drag = null;
      canvas.classList.remove("dragging");
    }

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    let pinch = null;
    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2 && state.photo) {
          const a = e.touches[0];
          const b = e.touches[1];
          pinch = {
            dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            scaleX: state.scaleX,
            scaleY: state.scaleY,
          };
          state.drag = null;
        }
      },
      { passive: false }
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (!pinch || e.touches.length !== 2 || !state.photo) return;
        e.preventDefault();
        const a = e.touches[0];
        const b = e.touches[1];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const factor = dist / (pinch.dist || 1);
        const { cx, cy } = photoCenter();
        state.scaleX = clampScale(pinch.scaleX * factor);
        state.scaleY = state.lockAspect
          ? state.scaleX
          : clampScale(pinch.scaleY * factor);
        const { w, h } = photoSize();
        state.ox = cx - w / 2;
        state.oy = cy - h / 2;
        syncTransformControls();
        render();
      },
      { passive: false }
    );
    canvas.addEventListener("touchend", () => {
      pinch = null;
    });
  }

  window.EvoEditor = {
    init,
    loadProduct,
    getProductId: () => state.productId,
    resize: () => {
      resizeCanvas();
      render();
    },
  };
})();
