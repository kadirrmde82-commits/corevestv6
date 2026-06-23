import { eq } from "drizzle-orm";
import { marketPrices, type MarketPrice } from "../db/schema";
import { getDb } from "./queries/connection";

type MarketCoin = Pick<MarketPrice, "id" | "symbol" | "name" | "basePrice" | "change" | "color" | "active" | "updatedAt"> & {
  live?: boolean;
  source?: "coingecko" | "binance" | "manual" | "cached";
  liveUpdatedAt?: string;
};

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
};

type BinanceTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
};

type LivePrice = {
  price: number;
  change: number;
  name: string;
  source: "coingecko" | "binance";
  stale?: boolean;
};

const COINGECKO_IDS_BY_SYMBOL: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  TRX: "tron",
  AVAX: "avalanche-2",
  TON: "the-open-network",
};

const BINANCE_SYMBOLS_BY_SYMBOL: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  BNB: "BNBUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  ADA: "ADAUSDT",
  TRX: "TRXUSDT",
  AVAX: "AVAXUSDT",
  TON: "TONUSDT",
};

const DISPLAY_NAMES_BY_SYMBOL: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "XRP",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  TRX: "TRON",
  AVAX: "Avalanche",
  TON: "Toncoin",
};

export const DEFAULT_MARKET_COINS: MarketCoin[] = [
  { id: -1, symbol: "BTC", name: "Bitcoin", basePrice: "65000", change: "0", color: "#F7931A", active: 1, updatedAt: new Date(0) },
  { id: -2, symbol: "ETH", name: "Ethereum", basePrice: "3500", change: "0", color: "#627EEA", active: 1, updatedAt: new Date(0) },
  { id: -3, symbol: "BNB", name: "BNB", basePrice: "600", change: "0", color: "#F3BA2F", active: 1, updatedAt: new Date(0) },
  { id: -4, symbol: "SOL", name: "Solana", basePrice: "150", change: "0", color: "#14F195", active: 1, updatedAt: new Date(0) },
  { id: -5, symbol: "XRP", name: "XRP", basePrice: "0.60", change: "0", color: "#25A768", active: 1, updatedAt: new Date(0) },
  { id: -6, symbol: "DOGE", name: "Dogecoin", basePrice: "0.12", change: "0", color: "#C2A633", active: 1, updatedAt: new Date(0) },
  { id: -7, symbol: "ADA", name: "Cardano", basePrice: "0.45", change: "0", color: "#0033AD", active: 1, updatedAt: new Date(0) },
  { id: -8, symbol: "TRX", name: "TRON", basePrice: "0.12", change: "0", color: "#FF060A", active: 1, updatedAt: new Date(0) },
  { id: -9, symbol: "AVAX", name: "Avalanche", basePrice: "35", change: "0", color: "#E84142", active: 1, updatedAt: new Date(0) },
  { id: -10, symbol: "TON", name: "Toncoin", basePrice: "6", change: "0", color: "#0098EA", active: 1, updatedAt: new Date(0) },
];

let cachedLivePrices: {
  expiresAt: number;
  prices: Map<string, LivePrice>;
} | null = null;

let lastSuccessfulLivePrices: {
  updatedAt: string;
  prices: Map<string, LivePrice>;
} | null = null;

function normalizeSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/USDT$/, "").replace(/USD$/, "").trim();
}

function combineWithPopularDefaults(rows: MarketPrice[]) {
  const activeRows: MarketCoin[] = rows.map((row) => ({
    ...row,
    symbol: normalizeSymbol(row.symbol),
    source: "cached",
    liveUpdatedAt: row.updatedAt?.toISOString(),
  }));

  const existingSymbols = new Set(activeRows.map((row) => row.symbol));
  const missingDefaults = DEFAULT_MARKET_COINS.filter((coin) => !existingSymbols.has(coin.symbol));

  return [...activeRows, ...missingDefaults].slice(0, 10);
}

async function fetchCoinGeckoPrices() {
  const ids = Object.values(COINGECKO_IDS_BY_SYMBOL).join(",");
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("ids", ids);
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "10");
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");
  url.searchParams.set("price_change_percentage", "24h");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "CoreVest market ticker",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`CoinGecko responded ${response.status}`);

  const data = (await response.json()) as CoinGeckoMarket[];
  const prices = new Map<string, LivePrice>();

  for (const coin of data) {
    if (coin.current_price == null) continue;
    prices.set(coin.symbol.toUpperCase(), {
      price: coin.current_price,
      change: coin.price_change_percentage_24h ?? 0,
      name: coin.name,
      source: "coingecko",
    });
  }

  return prices;
}

async function fetchBinancePrices() {
  const symbols = Object.values(BINANCE_SYMBOLS_BY_SYMBOL);
  const symbolsByPair = new Map(Object.entries(BINANCE_SYMBOLS_BY_SYMBOL).map(([symbol, pair]) => [pair, symbol]));
  const url = new URL("https://api.binance.com/api/v3/ticker/24hr");
  url.searchParams.set("symbols", JSON.stringify(symbols));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "CoreVest market ticker",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`Binance responded ${response.status}`);

  const data = (await response.json()) as BinanceTicker[];
  const prices = new Map<string, LivePrice>();

  for (const ticker of data) {
    const symbol = symbolsByPair.get(ticker.symbol);
    if (!symbol) continue;

    const price = Number(ticker.lastPrice);
    const change = Number(ticker.priceChangePercent);
    if (!Number.isFinite(price)) continue;

    prices.set(symbol, {
      price,
      change: Number.isFinite(change) ? change : 0,
      name: DISPLAY_NAMES_BY_SYMBOL[symbol] || symbol,
      source: "binance",
    });
  }

  return prices;
}

async function fetchLivePrices() {
  const now = Date.now();
  if (cachedLivePrices && cachedLivePrices.expiresAt > now) {
    return cachedLivePrices.prices;
  }

  const prices = new Map<string, LivePrice>();

  try {
    const coingeckoPrices = await fetchCoinGeckoPrices();
    for (const [symbol, live] of coingeckoPrices) prices.set(symbol, live);
  } catch (error) {
    console.warn("CoinGecko canlı piyasa verisi alınamadı, Binance deneniyor.", error);
  }

  if (prices.size < DEFAULT_MARKET_COINS.length) {
    try {
      const binancePrices = await fetchBinancePrices();
      for (const [symbol, live] of binancePrices) {
        if (!prices.has(symbol)) prices.set(symbol, live);
      }
    } catch (error) {
      console.warn("Binance canlı piyasa verisi alınamadı.", error);
    }
  }

  if (prices.size > 0) {
    lastSuccessfulLivePrices = {
      updatedAt: new Date().toISOString(),
      prices: new Map(prices),
    };
    cachedLivePrices = {
      expiresAt: now + 30_000,
      prices,
    };
    return prices;
  }

  if (lastSuccessfulLivePrices) {
    const stalePrices = new Map<string, LivePrice>();
    for (const [symbol, live] of lastSuccessfulLivePrices.prices) {
      stalePrices.set(symbol, { ...live, stale: true });
    }
    cachedLivePrices = {
      expiresAt: now + 10_000,
      prices: stalePrices,
    };
    return stalePrices;
  }

  cachedLivePrices = {
    expiresAt: now + 10_000,
    prices,
  };
  return prices;
}

async function persistLivePrices(prices: Map<string, LivePrice>) {
  if (prices.size === 0) return;
  const db = getDb();
  const existingRows = await db.select().from(marketPrices);
  const rowsBySymbol = new Map(existingRows.map((row) => [normalizeSymbol(row.symbol), row]));

  for (const [symbol, live] of prices) {
    if (live.stale) continue;
    const existing = rowsBySymbol.get(symbol);
    const values = {
      symbol,
      name: live.name || DISPLAY_NAMES_BY_SYMBOL[symbol] || symbol,
      basePrice: String(live.price),
      change: String(live.change),
      color: DEFAULT_MARKET_COINS.find((coin) => coin.symbol === symbol)?.color || "#FFD700",
      active: 1,
    };

    if (existing) {
      await db
        .update(marketPrices)
        .set({
          name: values.name,
          basePrice: values.basePrice,
          change: values.change,
          active: existing.active,
        })
        .where(eq(marketPrices.id, existing.id));
    } else {
      await db.insert(marketPrices).values(values);
    }
  }
}

export async function enrichMarketPrices(rows: MarketPrice[]) {
  const coins = combineWithPopularDefaults(rows);
  const livePrices = await fetchLivePrices();
  const updatedAt = new Date().toISOString();

  persistLivePrices(livePrices).catch((error) => {
    console.warn("Canlı piyasa fiyatları veritabanına kaydedilemedi.", error);
  });

  return coins.map((coin) => {
    const symbol = normalizeSymbol(coin.symbol);
    const live = livePrices.get(symbol);

    if (!live) {
      const hasSavedPrice = coin.id > 0;
      return {
        ...coin,
        symbol,
        live: false,
        source: hasSavedPrice ? "cached" as const : "manual" as const,
        liveUpdatedAt: hasSavedPrice && coin.updatedAt ? coin.updatedAt.toISOString() : undefined,
      };
    }

    return {
      ...coin,
      symbol,
      name: coin.name || live.name,
      basePrice: String(live.price),
      change: String(live.change),
      live: !live.stale,
      source: live.stale ? "cached" as const : live.source,
      liveUpdatedAt: live.stale && lastSuccessfulLivePrices ? lastSuccessfulLivePrices.updatedAt : updatedAt,
    };
  });
}
