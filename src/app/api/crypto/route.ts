const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const TRACKED_COINS = [
  'bitcoin',
  'ethereum',
  'solana',
  'binancecoin',
  'ripple',
];

export const GET = async () => {
  try {
    const url = new URL(`${COINGECKO_API}/coins/markets`);
    url.searchParams.set('vs_currency', 'usd');
    url.searchParams.set('ids', TRACKED_COINS.join(','));
    url.searchParams.set('order', 'market_cap_desc');
    url.searchParams.set('per_page', '5');
    url.searchParams.set('page', '1');
    url.searchParams.set('sparkline', 'false');
    url.searchParams.set('price_change_percentage', '24h');

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return Response.json(
        { message: 'Failed to fetch crypto data.' },
        { status: 502 },
      );
    }

    const data = await res.json();

    const coins = data.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      image: coin.image,
      currentPrice: coin.current_price,
      priceChange24h: coin.price_change_24h,
      priceChangePercent24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
    }));

    return Response.json({ coins });
  } catch (err) {
    console.error('Crypto widget error:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
