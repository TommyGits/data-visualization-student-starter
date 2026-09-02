import { useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { useDimensions } from '../week-01/useDimensions';

interface Summary {
  rows: number;
  columns: number;
  columnNames: string[];
  topGenres: { genre: string; count: number }[];
}

function parseCSV(text: string): Record<string, string>[] {
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
    return obj;
  });
}

const DATA_URL = `${import.meta.env.BASE_URL}data/games/games.csv`;

const FONT_SIZE = 20;
const LINE_HEIGHT = FONT_SIZE * 1.4;

export function SteamSum() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: divRef, dimensions } = useDimensions();
  const [summary, setSummary] = useState<Summary | null>(null);
  
  useEffect(() => {
    let cancelled = false;

    fetch(DATA_URL)
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return;

        const parsed = parseCSV(text);

        const genreCounts = new Map<string, number>();
        parsed.forEach((row) => {
          const genres = row.Genres;
          if (!genres) return;
          genres.split(',').forEach((g) => {
            const genre = g.trim();
            if (!genre) return;
            genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
          });
        });
        const topGenres = Array.from(genreCounts.entries())
          .map(([genre, count]) => ({ genre, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        setSummary({
          rows: parsed.length,
          columns: parsed.length > 0 ? Object.keys(parsed[0]).length : 0,
          columnNames: parsed.length > 0 ? Object.keys(parsed[0]) : [],
          topGenres,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !summary || dimensions.width === 0) return;

    const lines: string[] = [
      `Steam Games Dataset`,
      `Rows: ${summary.rows.toLocaleString()}`,
      `Columns: ${summary.columns}`,
      ``,
      `Top 10 Genres:`,
      ...summary.topGenres.map(
        (g, i) => `${i + 1}. ${g.genre} — ${g.count.toLocaleString()} games`,
      ),
    ];

    select(svg)
      .selectAll('text')
      .data(lines)
      .join('text')
      .attr('x', 20)
      .attr('y', (_, i) => (i + 1) * LINE_HEIGHT)
      .attr('font-size', FONT_SIZE)
      .attr('font-family', 'sans-serif')
      .attr('font-weight', (_, i) => (i === 0 || i === 4 ? 'bold' : 'normal'))
      .text((d) => d);
  }, [summary, dimensions]);

  return (
    <div ref={divRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
    </div>
  );
}
