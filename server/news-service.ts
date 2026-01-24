// Real-time sports news fetching service
// Uses native fetch available in Node.js 18+

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
  players: string[];
}

// Fetch real NFL news from Sleeper's trending players and news endpoint
export async function fetchSleeperTrending(): Promise<any[]> {
  try {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=25');
    if (!response.ok) return [];
    return await response.json() as any[];
  } catch (error) {
    console.error("Error fetching Sleeper trending:", error);
    return [];
  }
}

// Fetch real fantasy news from ESPN's public fantasy API
export async function fetchESPNFantasyNews(): Promise<NewsItem[]> {
  try {
    // ESPN's public fantasy news endpoint
    const response = await fetch('https://site.api.espn.com/apis/fantasy/v2/games/ffl/news?limit=20');
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const articles = data.feed || data.articles || [];
    
    return articles.map((article: any) => ({
      title: article.headline || article.title || "Fantasy Update",
      summary: article.description || article.summary || "",
      source: "ESPN Fantasy",
      url: article.links?.web?.href || article.url || "#",
      publishedAt: article.published || new Date().toISOString(),
      category: categorizeNews(article.headline || ""),
      players: extractPlayerNames(article.headline + " " + (article.description || "")),
    }));
  } catch (error) {
    console.error("Error fetching ESPN news:", error);
    return [];
  }
}

// Fetch NFL injury news from ESPN
export async function fetchNFLInjuryNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=15');
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const articles = data.articles || [];
    
    return articles
      .filter((article: any) => {
        const text = (article.headline || "") + " " + (article.description || "");
        return text.toLowerCase().includes("injur") || 
               text.toLowerCase().includes("out") ||
               text.toLowerCase().includes("questionable") ||
               text.toLowerCase().includes("return") ||
               text.toLowerCase().includes("practice");
      })
      .map((article: any) => ({
        title: article.headline || "Injury Update",
        summary: article.description || "",
        source: "ESPN NFL",
        url: article.links?.web?.href || "#",
        publishedAt: article.published || new Date().toISOString(),
        category: "injury",
        players: extractPlayerNames(article.headline + " " + (article.description || "")),
      }));
  } catch (error) {
    console.error("Error fetching NFL injury news:", error);
    return [];
  }
}

// Fetch general NFL news from ESPN
export async function fetchNFLNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=25');
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const articles = data.articles || [];
    
    return articles.map((article: any) => ({
      title: article.headline || "NFL Update",
      summary: article.description || "",
      source: "ESPN NFL",
      url: article.links?.web?.href || "#",
      publishedAt: article.published || new Date().toISOString(),
      category: categorizeNews(article.headline || ""),
      players: extractPlayerNames(article.headline + " " + (article.description || "")),
    }));
  } catch (error) {
    console.error("Error fetching NFL news:", error);
    return [];
  }
}

// Fetch all news from multiple sources
export async function fetchAllSportsNews(): Promise<NewsItem[]> {
  const [espnFantasy, nflNews, injuryNews] = await Promise.all([
    fetchESPNFantasyNews(),
    fetchNFLNews(),
    fetchNFLInjuryNews(),
  ]);
  
  // Combine and deduplicate by title
  const allNews = [...espnFantasy, ...nflNews, ...injuryNews];
  const seen = new Set<string>();
  const unique = allNews.filter(item => {
    const key = item.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Sort by published date (most recent first)
  return unique.sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

// Fetch news specifically for a player by name
export async function fetchPlayerNews(playerName: string, team?: string): Promise<NewsItem[]> {
  try {
    // Fetch from multiple ESPN endpoints and filter for the player
    const [nflNews, fantasyNews] = await Promise.all([
      fetchNFLNews(),
      fetchESPNFantasyNews(),
    ]);
    
    const allNews = [...nflNews, ...fantasyNews];
    const playerLower = playerName.toLowerCase();
    const lastName = playerName.split(' ').pop()?.toLowerCase() || "";
    const firstName = playerName.split(' ')[0]?.toLowerCase() || "";
    
    // Filter for news mentioning this player
    const playerNews = allNews.filter(item => {
      const text = (item.title + " " + item.summary).toLowerCase();
      // Match full name, or last name with team, or first + last name separately
      return text.includes(playerLower) || 
             (lastName.length > 3 && text.includes(lastName) && (!team || text.includes(team.toLowerCase()))) ||
             (text.includes(firstName) && text.includes(lastName));
    });
    
    // Sort by date and limit to top 5 most recent
    return playerNews
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 5);
  } catch (error) {
    console.error("Error fetching player news:", error);
    return [];
  }
}

// Filter news relevant to specific players
export function filterNewsForPlayers(news: NewsItem[], playerNames: string[]): NewsItem[] {
  if (!playerNames.length) return news;
  
  const playerSet = new Set(playerNames.map(n => n.toLowerCase()));
  const lastNames = playerNames.map(n => n.split(' ').pop()?.toLowerCase() || "");
  
  return news.filter(item => {
    const text = (item.title + " " + item.summary).toLowerCase();
    // Check for full name matches or last name matches
    return playerNames.some(name => {
      const nameLower = name.toLowerCase();
      const lastName = name.split(' ').pop()?.toLowerCase() || "";
      return text.includes(nameLower) || (lastName.length > 3 && text.includes(lastName));
    });
  });
}

// Categorize news based on content
function categorizeNews(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("injur") || lower.includes("out") || lower.includes("questionable") || 
      lower.includes("doubtful") || lower.includes("ir ") || lower.includes("practice")) {
    return "injury";
  }
  if (lower.includes("trade") || lower.includes("sign") || lower.includes("release") ||
      lower.includes("contract") || lower.includes("waiver") || lower.includes("cut")) {
    return "trade";
  }
  if (lower.includes("waiver") || lower.includes("pickup") || lower.includes("add ") ||
      lower.includes("stash")) {
    return "waiver";
  }
  return "analysis";
}

// Extract player names from text (basic heuristic)
function extractPlayerNames(text: string): string[] {
  // This is a simple heuristic - look for capitalized word pairs
  const words = text.split(/\s+/);
  const names: string[] = [];
  
  for (let i = 0; i < words.length - 1; i++) {
    const word1 = words[i].replace(/[^a-zA-Z]/g, "");
    const word2 = words[i + 1].replace(/[^a-zA-Z]/g, "");
    
    // Check if both words start with capital and are reasonable name lengths
    if (word1.length >= 2 && word2.length >= 2 &&
        word1[0] === word1[0].toUpperCase() && word1[1] === word1[1].toLowerCase() &&
        word2[0] === word2[0].toUpperCase() && word2[1] === word2[1].toLowerCase() &&
        word1.length <= 15 && word2.length <= 15) {
      // Exclude common non-name words
      const excludeWords = ['The', 'This', 'That', 'Week', 'NFL', 'ESPN', 'Fantasy', 'Super', 'Bowl', 
                           'Pro', 'All', 'First', 'Last', 'New', 'San', 'Los', 'Las', 'Green', 'Bay',
                           'Kansas', 'City', 'Tampa', 'New', 'York', 'And', 'The', 'For', 'With'];
      if (!excludeWords.includes(word1) && !excludeWords.includes(word2)) {
        names.push(`${word1} ${word2}`);
      }
    }
  }
  
  return Array.from(new Set(names)).slice(0, 5); // Return unique names, max 5
}
