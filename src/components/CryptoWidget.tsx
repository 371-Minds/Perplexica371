'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  marketCap: number;
}

const formatPrice = (price: number) => {
  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
};

const CryptoWidget = () => {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/crypto')
      .then((res) => res.json())
      .then((data) => {
        setCoins(data.coins || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-light-secondary dark:bg-dark-secondary rounded-2xl border border-light-200 dark:border-dark-200 shadow-sm shadow-light-200/10 dark:shadow-black/25 p-3 w-full animate-pulse">
        <div className="h-4 bg-light-200 dark:bg-dark-200 rounded w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-light-200 dark:bg-dark-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || coins.length === 0) return null;

  return (
    <div className="bg-light-secondary dark:bg-dark-secondary rounded-2xl border border-light-200 dark:border-dark-200 shadow-sm shadow-light-200/10 dark:shadow-black/25 p-3 w-full">
      <p className="text-xs text-black/50 dark:text-white/50 font-medium mb-2 uppercase tracking-wide">
        Crypto
      </p>
      <div className="space-y-1.5">
        {coins.map((coin) => {
          const positive = coin.priceChangePercent24h > 0;
          const negative = coin.priceChangePercent24h < 0;

          return (
            <div key={coin.id} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <img
                  src={coin.image}
                  alt={coin.name}
                  className="w-4 h-4 rounded-full"
                />
                <span className="text-xs font-semibold text-black/80 dark:text-white/80">
                  {coin.symbol}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-black/70 dark:text-white/70">
                  ${formatPrice(coin.currentPrice)}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    positive
                      ? 'text-green-500'
                      : negative
                        ? 'text-red-500'
                        : 'text-black/50 dark:text-white/50'
                  }`}
                >
                  {positive ? (
                    <TrendingUp size={10} />
                  ) : negative ? (
                    <TrendingDown size={10} />
                  ) : (
                    <Minus size={10} />
                  )}
                  {Math.abs(coin.priceChangePercent24h).toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CryptoWidget;
