// The Odds API service for fetching NFL game odds

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

interface Market {
  key: string;
  outcomes: Outcome[];
}

interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

interface OddsGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface GameOdds {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  spread: {
    homeSpread: number;
    homeOdds: number;
    awaySpread: number;
    awayOdds: number;
  } | null;
  moneyline: {
    homeOdds: number;
    awayOdds: number;
  } | null;
  total: {
    over: number;
    overOdds: number;
    under: number;
    underOdds: number;
  } | null;
  bookmaker: string;
}

const API_BASE = "https://api.the-odds-api.com/v4";

export async function fetchNFLOdds(): Promise<GameOdds[]> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  
  if (!apiKey) {
    console.error("THE_ODDS_API_KEY is not set");
    return [];
  }

  try {
    const url = `${API_BASE}/sports/americanfootball_nfl/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Odds API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const games: OddsGame[] = await response.json();
    
    return games.map(game => {
      if (!game.bookmakers || game.bookmakers.length === 0) {
        return {
          id: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          commenceTime: game.commence_time,
          spread: null,
          moneyline: null,
          total: null,
          bookmaker: "N/A",
        };
      }

      // Find the first bookmaker that has each market type
      let spreadsMarket: Market | undefined;
      let h2hMarket: Market | undefined;
      let totalsMarket: Market | undefined;
      let primaryBookmaker = game.bookmakers[0].title;

      for (const bookmaker of game.bookmakers) {
        if (!spreadsMarket) {
          const found = bookmaker.markets.find(m => m.key === "spreads");
          if (found) {
            spreadsMarket = found;
            primaryBookmaker = bookmaker.title;
          }
        }
        if (!h2hMarket) {
          const found = bookmaker.markets.find(m => m.key === "h2h");
          if (found) h2hMarket = found;
        }
        if (!totalsMarket) {
          const found = bookmaker.markets.find(m => m.key === "totals");
          if (found) totalsMarket = found;
        }
        if (spreadsMarket && h2hMarket && totalsMarket) break;
      }

      let spread = null;
      if (spreadsMarket) {
        const homeOutcome = spreadsMarket.outcomes.find(o => o.name === game.home_team);
        const awayOutcome = spreadsMarket.outcomes.find(o => o.name === game.away_team);
        if (homeOutcome && awayOutcome) {
          spread = {
            homeSpread: homeOutcome.point || 0,
            homeOdds: homeOutcome.price,
            awaySpread: awayOutcome.point || 0,
            awayOdds: awayOutcome.price,
          };
        }
      }

      let moneyline = null;
      if (h2hMarket) {
        const homeOutcome = h2hMarket.outcomes.find(o => o.name === game.home_team);
        const awayOutcome = h2hMarket.outcomes.find(o => o.name === game.away_team);
        if (homeOutcome && awayOutcome) {
          moneyline = {
            homeOdds: homeOutcome.price,
            awayOdds: awayOutcome.price,
          };
        }
      }

      let total = null;
      if (totalsMarket) {
        const overOutcome = totalsMarket.outcomes.find(o => o.name === "Over");
        const underOutcome = totalsMarket.outcomes.find(o => o.name === "Under");
        if (overOutcome && underOutcome) {
          total = {
            over: overOutcome.point || 0,
            overOdds: overOutcome.price,
            under: underOutcome.point || 0,
            underOdds: underOutcome.price,
          };
        }
      }

      return {
        id: game.id,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        spread,
        moneyline,
        total,
        bookmaker: primaryBookmaker,
      };
    });
  } catch (error) {
    console.error("Error fetching NFL odds:", error);
    return [];
  }
}
