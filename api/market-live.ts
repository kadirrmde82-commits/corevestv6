import type { MarketPrice } from "../db/schema";

type MarketCoin = Pick<MarketPrice, "id" | "symbol" | "name" | "basePrice" | "change" | "color" | "active"> & {
  live?: boolean;
  source?: "coingecko" | "manual";
  liveUpdatedAt?: string;
};

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
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

export const DEFAULT_MARKET_COINS: MarketCoin[] = [
  { id: -1, symbol: "BTC", name: "Bitcoin", basePrice: "65000", change: "0", color: "#F7931A", active: 1 },
  { id: -2, symbol: "ETH", name: "Ethereum", basePrice: "3500", change: "0", color: "#627EEA", active: 1 },
  { id: -3, symbol: "BNB", name: "BNB", basePrice: "600", change: "0", color: "#F3BA2F", active: 1 },
  { id: -4, symbol: "SOL", name: "Solana", basePrice: "150", change: "0", color: "#14F195", active: 1 },
  { id: -5, symbol: "XRP", name: "XRP", basePrice: "0.60", change: "0", color: "#25A768", active: 1 },
  { id: -6, symbol: "DOGE", name: "Dogecoin", basePrice: "0.12", change: "0", color: "#C2A633", active: 1 },
  { id: -7, symbol: "ADA", name: "Cardano", basePrice: "0.45", change: "0", color: "#0033AD", active: 1 },
  { id: -8, symbol: "TRX", name: "TRON", basePrice: "0.12", change: "0", color: "#FF060A", active: 1 },
  { id: -9, symbol: "AVAX", name: "Avalanche", basePrice: "35", change: "0", color: "#E84142", active: 1 },
  { id: -10, symbol: "TON", name: "Toncoin", basePrice: "6", change: "0", color: "#0098EA", active: 1 },
];

let cachedLivePrices: {
  expiresAt: number;
  prices: Map<string, { price: number; change: number; name: string }>;
} | null = null;

function normalizeSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/USDT$/, "").replace(/USD$/, "").trim();
}

function combineWithPopularDefaults(rows: MarketPrice[]) {
  const activeRows: MarketCoin[] = rows.map((row) => ({
    ...row,
    symbol: normalizeSymbol(row.symbol),
    source: "manual",
  }));

  const existingSymbols = new Set(activeRows.map((row) => row.symbol));
  const missingDefaults = DEFAULT_MARKET_COINS.filter((coin) => !existingSymbols.has(coin.symbol));

  return [...activeRows, ...missingDefaults].slice(0, 10);
}

async function fetchLivePrices() {
  const now = Date.now();
  if (cachedLivePrices && cachedLivePrices.expiresAt > now) {
    return cachedLivePrices.prices;
  }

  const ids = Object.values(COINGECKO_IDS_BY_SYMBOL).join(",");
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("ids", ids);
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "10");
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");
  url.searchParams.set("price_change_percentage", "24h");

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "CoreVest market ticker",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`CoinGecko responded ${response.status}`);

    const data = (await response.json()) as CoinGeckoMarket[];
    const prices = new Map<string, { price: number; change: number; name: string }>();

    for (const coin of data) {
      if (coin.current_price == null) continue;
      prices.set(coin.symbol.toUpperCase(), {
        price: coin.current_price,
        change: coin.price_change_percentage_24h ?? 0,
        name: coin.name,
      });
    }

    cachedLivePrices = {
      expiresAt: now + 30_000,
      prices,
    };
    return prices;
  } catch (error) {
    console.warn("Canlı piyasa verisi alınamadı, manuel fiyatlar gösterilecek.", error);
    cachedLivePrices = {
      expiresAt: now + 10_000,
      prices: new Map(),
    };
    return cachedLivePrices.prices;
  }
}

export async function enrichMarketPrices(rows: MarketPrice[]) {
  const coins = combineWithPopularDefaults(rows);
  const livePrices = await fetchLivePrices();
  const updatedAt = new Date().toISOString();

  return coins.map((coin) => {
    const symbol = normalizeSymbol(coin.symbol);
    const live = livePrices.get(symbol);

    if (!live) {
      return {
        ...coin,
        symbol,
        live: false,
        source: "manual" as const,
      };
    }

    return {
      ...coin,
      symbol,
      name: coin.name || live.name,
      basePrice: String(live.price),
      change: String(live.change),
      live: true,
      source: "coingecko" as const,
      liveUpdatedAt: updatedAt,
    };
  });
}
