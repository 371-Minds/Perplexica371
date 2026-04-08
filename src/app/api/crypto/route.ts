export const GET = async () => {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,binancecoin,ripple&order=market_cap_desc&per_page=5&page=1&sparkline=false&price_change_percentage=24h',
      {
        headers: {
          Accept: 'application/json',
        },
        next: { revalidate: 60 },
      },
    );

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
