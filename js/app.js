(function () {
  function $(id) {
    return document.getElementById(id);
  }

  let currentFlow = "carta"; // carta | postal

  function showView(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    const el = $(`view-${name}`);
    if (el) el.classList.add("active");
    if (name === "edit" && window.EvoEditor) {
      requestAnimationFrame(() => {
        EvoEditor.resize();
        requestAnimationFrame(() => EvoEditor.resize());
      });
    }
  }

  function setHint(text) {
    const h = $("headerHint");
    if (h) h.textContent = text;
  }

  async function openEditCarta() {
    currentFlow = "carta";
    setHint("Cartas · edición");
    await EvoEditor.loadProduct("sobre");
    showView("edit");
  }

  async function openEditPostal() {
    currentFlow = "postal";
    setHint("Postales · edición");
    const id = EvoEditor.getProductId?.();
    const start =
      id === "postal-grande" || id === "postal-chica" ? id : "postal-chica";
    await EvoEditor.loadProduct(start);
    showView("edit");
  }

  function openPdfCarta() {
    currentFlow = "carta";
    setHint("Cartas · PDF");
    showView("assemble-carta");
  }

  function openPdfPostal() {
    currentFlow = "postal";
    setHint("Postales · PDF");
    showView("assemble-postal");
  }

  async function boot() {
    await EvoEditor.init();
    const sobre = await fetch("templates/sobre/layout.json?v=20").then((r) => r.json());
    await EvoPdf.initCarta(sobre);
    await EvoPdf.initPostal();

    $("btnGoEditCarta").addEventListener("click", openEditCarta);
    $("btnGoPdfCarta").addEventListener("click", openPdfCarta);
    $("btnGoEditPostal").addEventListener("click", openEditPostal);
    $("btnGoPdfPostal").addEventListener("click", openPdfPostal);

    $("btnBackHome1").addEventListener("click", () => {
      setHint("Cartas · Postales");
      showView("home");
    });
    $("btnBackHomeCarta").addEventListener("click", () => {
      setHint("Cartas · Postales");
      showView("home");
    });
    $("btnBackHomePostal").addEventListener("click", () => {
      setHint("Cartas · Postales");
      showView("home");
    });

    $("btnGoPdfFromEdit").addEventListener("click", () => {
      if (currentFlow === "postal") openPdfPostal();
      else openPdfCarta();
    });
    $("btnGoEditFromPdfCarta").addEventListener("click", openEditCarta);
    $("btnGoEditFromPdfPostal").addEventListener("click", openEditPostal);

    window.EvoApp = {
      onProductChanged(productId) {
        if (productId.startsWith("postal")) {
          setHint("Postales · edición");
        }
      },
    };

    showView("home");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
