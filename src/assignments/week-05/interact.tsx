import { useEffect, useMemo, useRef, useState } from 'react';
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

const ACCENT = '#e67e22';

interface TooltipState {
  x: number;
  y: number;
  game: Game;
}

interface TooltipBoxProps extends TooltipState {
  containerWidth: number;
  containerHeight: number;
  pinned?: boolean;
}

function TooltipBox({
  x,
  y,
  game,
  containerWidth,
  containerHeight,
  pinned = false,
}: TooltipBoxProps) {
  const flipX = x > containerWidth - 230;
  const flipY = y > containerHeight - 110;

  return (
    <div
      style={{
        position: 'absolute',
        left: flipX ? x - 12 : x + 12,
        top: flipY ? y - 12 : y + 12,
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
        background: 'rgba(0,0,0,0.88)',
        color: 'white',
        padding: '8px 10px',
        borderRadius: 4,
        border: pinned ? `2px solid ${ACCENT}` : '2px solid transparent',
        fontSize: 12,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        maxWidth: 260,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <strong>{game.name}</strong>
      <br />
      Price: {game.price === 0 ? 'Free' : `$${game.price.toFixed(2)}`}
      <br />
      Peak CCU: {game.peakCCU.toLocaleString()}
      <br />
      <span style={{ opacity: 0.6 }}>
        {pinned ? 'Click to unpin' : 'Click to pin'}
      </span>
    </div>
  );
}

export function interact() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: divRef, dimensions } = useDimensions();

  const [games, setGames] = useState<Game[]>([]);
  const [hovered, setHovered] = useState<TooltipState | null>(null);
  const [pinned, setPinned] = useState<TooltipState | null>(null);
  const [priceCap, setPriceCap] = useState(100);

  const pinnedRef = useRef<TooltipState | null>(null);
  pinnedRef.current = pinned;

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

  const visibleGames = useMemo(
    () => games.filter((game) => game.price <= priceCap),
    [games, priceCap]
  );

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg || dimensions.width === 0) {
      return;
    }

    const svgSelection = select(svg);
    svgSelection.selectAll('*').remove();
    setHovered(null);
    setPinned(null);

    if (visibleGames.length === 0) {
      return;
    }

    const width = dimensions.width;
    const height = dimensions.height;

    const margin = { top: 60, right: 40, bottom: 70, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxCCU = Math.max(...visibleGames.map((d) => d.peakCCU));

    const xScale = scaleLinear()
      .domain([0, priceCap])
      .range([0, chartWidth]);

    const yScale = scaleLinear()
      .domain([0, maxCCU])
      .range([chartHeight, 0]);

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

    const guides = chart
      .append('g')
      .attr('pointer-events', 'none')
      .style('display', 'none');

    const guideV = guides
      .append('line')
      .attr('stroke', '#555')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3');

    const guideH = guides
      .append('line')
      .attr('stroke', '#555')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3');

    svgSelection.on('click', () => setPinned(null));

    chart
      .selectAll('circle')
      .data(visibleGames)
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => xScale(d.price))
      .attr('cy', (d) => yScale(d.peakCCU))
      .attr('r', 3)
      .attr('fill', '#3498db')
      .attr('opacity', 0.35)
      .attr('stroke', 'none')
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        const cx = xScale(d.price);
        const cy = yScale(d.peakCCU);

        select(this).attr('r', 6).attr('opacity', 1).attr('stroke', '#222').attr('stroke-width', 1);

        guideV.attr('x1', cx).attr('x2', cx).attr('y1', cy).attr('y2', chartHeight);
        guideH.attr('x1', 0).attr('x2', cx).attr('y1', cy).attr('y2', cy);
        guides.style('display', null);

        setHovered({ x: event.offsetX, y: event.offsetY, game: d });
      })
      .on('mousemove', function (event) {
        setHovered((t) => (t ? { ...t, x: event.offsetX, y: event.offsetY } : t));
      })
      .on('mouseleave', function (_event, d) {
        const isPinned = pinnedRef.current?.game === d;

        select(this)
          .attr('r', isPinned ? 6 : 3)
          .attr('opacity', isPinned ? 1 : 0.35)
          .attr('stroke', isPinned ? ACCENT : 'none')
          .attr('stroke-width', isPinned ? 2 : 1);

        guides.style('display', 'none');
        setHovered(null);
      })
      .on('click', function (event, d) {
        event.stopPropagation();

        if (pinnedRef.current?.game === d) {
          setPinned(null);
          return;
        }

        setPinned({
          x: xScale(d.price) + margin.left,
          y: yScale(d.peakCCU) + margin.top,
          game: d,
        });
      });
  }, [visibleGames, priceCap, dimensions]);

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg) return;

    select(svg)
      .selectAll<SVGCircleElement, Game>('circle.dot')
      .attr('r', (d) => (pinned?.game === d ? 6 : 3))
      .attr('opacity', (d) => (pinned?.game === d ? 1 : 0.35))
      .attr('stroke', (d) => (pinned?.game === d ? ACCENT : 'none'))
      .attr('stroke-width', (d) => (pinned?.game === d ? 2 : 1));
  }, [pinned, visibleGames, dimensions]);

  return (
    <div
      ref={divRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 12,
          color: '#333',
          background: 'rgba(255,255,255,0.9)',
          padding: '8px 10px',
          border: '1px solid #ddd',
          borderRadius: 4,
        }}
      >
        <label htmlFor="price-cap">
          Max price: ${priceCap} ({visibleGames.length.toLocaleString()} games)
        </label>
        <input
          id="price-cap"
          type="range"
          min={1}
          max={100}
          step={1}
          value={priceCap}
          onChange={(e) => setPriceCap(Number(e.target.value))}
        />
      </div>
      {pinned && (
        <TooltipBox
          {...pinned}
          pinned
          containerWidth={dimensions.width}
          containerHeight={dimensions.height}
        />
      )}
      {hovered && hovered.game !== pinned?.game && (
        <TooltipBox
          {...hovered}
          containerWidth={dimensions.width}
          containerHeight={dimensions.height}
        />
      )}
    </div>
  );
}
