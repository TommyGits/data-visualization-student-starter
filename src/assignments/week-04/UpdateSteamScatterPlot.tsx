import { useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { useDimensions } from '../week-01/useDimensions';

interface Game {
  name: string;
  price: number;
  peakCCU: number;
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

        if (char === '\r' && next === '\n') {
          i++;
        }
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

interface TooltipState {
  x: number;
  y: number;
  game: Game;
}

export function UpdateSteamScatterPlot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: divRef, dimensions } = useDimensions();

  const [games, setGames] = useState<Game[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(DATA_URL)
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return;

        const parsed = parseCSV(text);

        const gameData: Game[] = parsed
          .map((row) => ({
            name: row.Name,
            price: Number(row.Price),
            peakCCU: Number(row['Peak CCU']),
          }))
          .filter(
            (game) =>
              game.name &&
              Number.isFinite(game.price) &&
              Number.isFinite(game.peakCCU) &&
              game.peakCCU >= 5 &&
              game.price <= 100
          );

        setGames(gameData);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg || games.length === 0 || dimensions.width === 0) {
      return;
    }

    const width = dimensions.width;
    const height = dimensions.height;

    const margin = { top: 60, right: 40, bottom: 70, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxPrice = Math.max(...games.map((d) => d.price));
    const maxCCU = Math.max(...games.map((d) => d.peakCCU));

    const xScale = scaleLinear()
      .domain([0, maxPrice])
      .range([0, chartWidth]);

    const yScale = scaleLinear()
      .domain([0, maxCCU])
      .range([chartHeight, 0]);

    const svgSelection = select(svg);
    svgSelection.selectAll('*').remove();

    const chart = svgSelection
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    chart
      .append('text')
      .attr('x', chartWidth / 2)
      .attr('y', -25)
      .attr('text-anchor', 'middle')
      .attr('font-size', 22)
      .attr('font-weight', 'bold')
      .text('Game Price vs. Peak Players');

    const xTicks = xScale.ticks(6);
    const yTicks = yScale.ticks(6);

    chart
      .append('g')
      .attr('opacity', 0.08)
      .selectAll('line.grid-x')
      .data(xTicks)
      .join('line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', 'black');

    chart
      .append('g')
      .attr('opacity', 0.08)
      .selectAll('line.grid-y')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'black');

    chart
      .append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call((g) => {
        g.selectAll('text')
          .data(xTicks)
          .join('text')
          .attr('x', (d) => xScale(d))
          .attr('y', 20)
          .attr('text-anchor', 'middle')
          .attr('font-size', 12)
          .attr('fill', '#555')
          .text((d) => `$${d}`);

        g.append('line')
          .attr('x1', 0)
          .attr('x2', chartWidth)
          .attr('y1', 0)
          .attr('y2', 0)
          .attr('stroke', '#999');
      });

    chart
      .append('text')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight + 50)
      .attr('text-anchor', 'middle')
      .attr('font-size', 15)
      .attr('fill', '#333')
      .text('Game Price ($)');

    chart.append('g').call((g) => {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', 0)
        .attr('y1', 0)
        .attr('y2', chartHeight)
        .attr('stroke', '#999');

      g.selectAll('text')
        .data(yTicks)
        .join('text')
        .attr('x', -10)
        .attr('y', (d) => yScale(d))
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 12)
        .attr('fill', '#555')
        .text((d) => d.toLocaleString());
    });

    chart
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -chartHeight / 2)
      .attr('y', -55)
      .attr('text-anchor', 'middle')
      .attr('font-size', 15)
      .attr('fill', '#333')
      .text('Peak Concurrent Players');

    chart
      .selectAll('circle')
      .data(games)
      .join('circle')
      .attr('cx', (d) => xScale(d.price))
      .attr('cy', (d) => yScale(d.peakCCU))
      .attr('r', 3)
      .attr('fill', '#3498db')
      .attr('opacity', 0.35)
      .attr('stroke', 'none')
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        select(this).attr('r', 6).attr('opacity', 1).attr('stroke', '#222').attr('stroke-width', 1);
        setTooltip({ x: event.offsetX, y: event.offsetY, game: d });
      })
      .on('mousemove', function (event) {
        setTooltip((t) => (t ? { ...t, x: event.offsetX, y: event.offsetY } : t));
      })
      .on('mouseleave', function () {
        select(this).attr('r', 3).attr('opacity', 0.35).attr('stroke', 'none');
        setTooltip(null);
      });
  }, [games, dimensions]);

  return (
    <div
      ref={divRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            background: 'rgba(0,0,0,0.85)',
            color: 'white',
            padding: '8px 10px',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <strong>{tooltip.game.name}</strong>
          <br />
          Price: ${tooltip.game.price.toFixed(2)}
          <br />
          Peak CCU: {tooltip.game.peakCCU.toLocaleString()}
        </div>
      )}
    </div>
  );
}