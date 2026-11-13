/** Nombres de descarga cortos: GAIIA-S-001.png etc. */
(function () {
  function nextDownloadName(kind) {
    const key = `gaiia-seq-${kind}`;
    let n = parseInt(localStorage.getItem(key) || "0", 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
    n = (n % 999) + 1;
    localStorage.setItem(key, String(n));
    const num = String(n).padStart(3, "0");
    const map = {
      S: `GAIIA-S-${num}.png`,
      PG: `GAIIA-PG-${num}.png`,
      PC: `GAIIA-PC-${num}.png`,
      "PDF-S": `GAIIA-PDF-S-${num}.pdf`,
      "PDF-P": `GAIIA-PDF-P-${num}.pdf`,
    };
    return map[kind] || `GAIIA-${kind}-${num}`;
  }

  function kindForProduct(productId) {
    if (productId === "sobre") return "S";
    if (productId === "postal-grande") return "PG";
    if (productId === "postal-chica") return "PC";
    return "S";
  }

  window.EvoNames = { nextDownloadName, kindForProduct };
})();
