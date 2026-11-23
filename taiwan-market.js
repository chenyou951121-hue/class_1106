const marketSymbols = [
  { proName: "TWSE:IX0001", title: "加權指數" },
  { proName: "TWSE:2330", title: "台積電" },
  { proName: "TWSE:2317", title: "鴻海" },
  { proName: "TWSE:2454", title: "聯發科" },
];

export function initTaiwanMarketBoard() {
  const container = document.getElementById("taiwanMarketTicker");
  if (!container || container.dataset.loaded) return;

  container.dataset.loaded = "true";
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
  script.async = true;
  script.textContent = JSON.stringify({
    symbols: marketSymbols,
    showSymbolLogo: true,
    isTransparent: true,
    displayMode: "adaptive",
    colorTheme: "light",
    locale: "zh_TW",
  });
  script.addEventListener("error", () => {
    container.textContent = "台股行情暫時無法載入，請稍後再試。";
  });
  container.appendChild(script);
}
