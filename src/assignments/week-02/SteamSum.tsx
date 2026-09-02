import { useEffect, useState } from 'react';

interface GameRow {
  AppID: string;
  Name: string;
  'Release date': string;
  'Estimated owners': string;
  'Peak CCU': string;
  'Required age': string;
  Price: string;
  Discount: string;
  'DLC count': string;
  Windows: string;
  Mac: string;
  Linux: string;
  'Metacritic score': string;
  'User score': string;
  Positive: string;
  Negative: string;
  Achievements: string;
  Recommendations: string;
  'Average playtime forever': string;
  'Median playtime forever': string;
  Developers: string;
  Publishers: string;
  Categories: string;
  Genres: string;
  Tags: string;
}

interface SummaryStats {
  rowCount: number;
  columnCount: number;
  columnNames: string[];
  averagePrice: number;
  averageMetacritic: number;
  windowsCount: number;
  macCount: number;
  linuxCount: number;
  topGenres: { genre: string; count: number }[];
}

function parseCSV(text: string): GameRow[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (field.length > 0 || current.length > 0) {
          current.push(field);
          rows.push(current);
          current = [];
          field = '';
        }
        if (char === '\r' && next === '\n') i++;
      } else {
        field += char;
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj as unknown as GameRow;
  });
}

function summarize(data: GameRow[]): SummaryStats {
  const columnNames = data.length > 0 ? Object.keys(data[0]) : [];

  const prices = data
    .map((d) => parseFloat(d.Price))
    .filter((p) => !Number.isNaN(p));
  const averagePrice =
    prices.reduce((sum, p) => sum + p, 0) / (prices.length || 1);

  const metacriticScores = data
    .map((d) => parseFloat(d['Metacritic score']))
    .filter((s) => !Number.isNaN(s) && s > 0);
  const averageMetacritic =
    metacriticScores.reduce((sum, s) => sum + s, 0) /
    (metacriticScores.length || 1);

  const windowsCount = data.filter((d) => d.Windows === 'True').length;
  const macCount = data.filter((d) => d.Mac === 'True').length;
  const linuxCount = data.filter((d) => d.Linux === 'True').length;

  const genreCounts = new Map<string, number>();
  data.forEach((d) => {
    if (!d.Genres) return;
    d.Genres.split(',').forEach((g) => {
      const genre = g.trim();
      if (!genre) return;
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    });
  });
  const topGenres = Array.from(genreCounts.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    rowCount: data.length,
    columnCount: columnNames.length,
    columnNames,
    averagePrice,
    averageMetacritic,
    windowsCount,
    macCount,
    linuxCount,
    topGenres,
  };
}

export function SteamSum() {
  const [data, setData] = useState<GameRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  fetch(`${import.meta.env.BASE_URL}data/games/games.csv`)      .then((res) => res.text())
      .then((text) => setData(parseCSV(text)))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <p style={{ color: 'red' }}>Failed to load dataset: {error}</p>;
  }

  if (!data) {
    return <p>Loading dataset...</p>;
  }

  const stats = summarize(data);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '1rem', maxWidth: 700 }}>
      <h2>Steam Games Dataset Summary</h2>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3>Shape</h3>
        <p>
          <strong>{stats.rowCount.toLocaleString()}</strong> rows &times;{' '}
          <strong>{stats.columnCount}</strong> columns
        </p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3>Columns</h3>
        <ul
          style={{
            columns: 2,
            listStyle: 'none',
            paddingLeft: 0,
            fontSize: '0.9rem',
          }}
        >
          {stats.columnNames.map((col) => (
            <li key={col}>{col}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3>Quick Stats</h3>
        <ul>
          <li>Average price: ${stats.averagePrice.toFixed(2)}</li>
          <li>
            Average Metacritic score (rated games only):{' '}
            {stats.averageMetacritic.toFixed(1)}
          </li>
          <li>Windows support: {stats.windowsCount.toLocaleString()} games</li>
          <li>Mac support: {stats.macCount.toLocaleString()} games</li>
          <li>Linux support: {stats.linuxCount.toLocaleString()} games</li>
        </ul>
      </section>

      <section>
        <h3>Top 10 Genres</h3>
        <ol>
          {stats.topGenres.map(({ genre, count }) => (
            <li key={genre}>
              {genre} &mdash; {count.toLocaleString()} games
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}