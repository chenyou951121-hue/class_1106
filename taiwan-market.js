const marketSymbols = [
  { exchangeCode: "tse_t00.tw", code: "t00", name: "加權指數", tvSymbol: "TWSE:IX0001" },
  { exchangeCode: "tse_2330.tw", code: "2330", name: "台積電", tvSymbol: "TWSE:2330" },
  { exchangeCode: "tse_2317.tw", code: "2317", name: "鴻海", tvSymbol: "TWSE:2317" },
  { exchangeCode: "tse_2454.tw", code: "2454", name: "聯發科", tvSymbol: "TWSE:2454" },
];
const marketDataUrl = "https://daily-sequence-market.chenyou951121.workers.dev/";

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "" || value === "-") return null;
  const number = Number(value.replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
}

function firstNumber(values) {
  for (const value of values) {
    const number = parseNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function formatPrice(value) {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value);
}

function createQuoteCard(symbol, quote) {
  const card = document.createElement("a");
  card.className = "market-quote";
  card.href = `https://tw.tradingview.com/symbols/${symbol.tvSymbol.replace(":", "-")}/`;
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  const label = document.createElement("span");
  label.className = "market-quote-name";
  label.textContent = symbol.name;

  const price = document.createElement("strong");
  price.className = "market-quote-price";

  const change = document.createElement("span");
  change.className = "market-quote-change";

  if (!quote || quote.price === null || quote.previousClose === null) {
    price.textContent = "暫無報價";
    change.textContent = "點此查看圖表 →";
  } else {
    const difference = quote.price - quote.previousClose;
    const percentage = quote.previousClose ? (difference / quote.previousClose) * 100 : 0;
    const direction = difference > 0 ? "up" : difference < 0 ? "down" : "flat";
    card.classList.add(`is-${direction}`);
    price.textContent = formatPrice(quote.price);
    change.textContent = `${difference > 0 ? "+" : ""}${formatPrice(difference)} (${percentage > 0 ? "+" : ""}${percentage.toFixed(2)}%)`;
  }

  card.append(label, price, change);
  return card;
}

function renderQuotes(container, quotes) {
  const fragment = document.createDocumentFragment();
  for (const symbol of marketSymbols) {
    fragment.appendChild(createQuoteCard(symbol, quotes.get(symbol.code)));
  }
  container.replaceChildren(fragment);
}

async function updateMarketQuotes(container, note) {
  try {
    const response = await fetch(marketDataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`行情服務回應 ${response.status}`);

    const result = await response.json();
    const quotes = new Map();
    for (const item of result.msgArray || []) {
      quotes.set(item.c, {
        price: firstNumber([item.z, item.trade?.z, item.tv, item.pz]),
        previousClose: firstNumber([item.y, item.pz]),
      });
    }

    renderQuotes(container, quotes);
    const updatedAt = result.queryTime?.sysTime;
    note.textContent = updatedAt
      ? `證交所行情・更新於 ${updatedAt}`
      : "證交所行情・盤中資料可能延遲";
  } catch (error) {
    console.warn("Could not load Taiwan stock quotes.", error);
    renderQuotes(container, new Map());
    note.textContent = "行情暫時無法連線・點選個股查看圖表";
  }
}

export function initTaiwanMarketBoard() {
  const container = document.getElementById("taiwanMarketTicker");
  const note = document.getElementById("marketBoardNote");
  if (!container || container.dataset.loaded) return;

  container.dataset.loaded = "true";
  updateMarketQuotes(container, note);
  window.setInterval(() => updateMarketQuotes(container, note), 60_000);
}
