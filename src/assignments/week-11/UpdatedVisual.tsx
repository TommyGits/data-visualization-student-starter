import { useId, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import type { ScaleContinuousNumeric } from "d3-scale";
import rawData from "../week-06/stocks.csv?raw";
import datasetUrl from "../week-06/stocks.csv?url";
import "./UpdatedVisual.css";

const assets = {
  AAPL: { name: "Apple", color: "#087f70" },
  MSFT: { name: "Microsoft", color: "#4263eb" },
  IBM: { name: "IBM", color: "#9c36b5" },
  SBUX: { name: "Starbucks", color: "#b56508" },
  GSPC: { name: "S&P 500", color: "#64748b" },
};
type Symbol = keyof typeof assets;
type Row = { date: string } & Record<Symbol, number>;
type View = { start: string; end: string; preset: string };

const symbols = Object.keys(assets) as Symbol[];
const rows: Row[] = rawData
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [MSFT, IBM, SBUX, AAPL, GSPC, date] = line
      .replaceAll('"', "")
      .split(",");
    return {
      date,
      MSFT: Number(MSFT),
      IBM: Number(IBM),
      SBUX: Number(SBUX),
      AAPL: Number(AAPL),
      GSPC: Number(GSPC),
    };
  });

// Market events: start/end shade the band on the chart,
// viewStart/viewEnd is the window the preset button zooms to.
const events = [
  {
    id: "crash",
    label: "Financial crisis",
    button: "2008 crash",
    start: "2008-09-15",
    end: "2009-03-09",
    viewStart: "2008-06-01",
    viewEnd: "2009-06-30",
  },
  {
    id: "recovery",
    label: "Recovery",
    button: "Recovery",
    start: "2009-03-09",
    end: "2010-12-31",
    viewStart: "2009-03-09",
    viewEnd: "2010-12-31",
  },
  {
    id: "selloff",
    label: "Aug 2015 selloff",
    button: "Aug 2015",
    start: "2015-08-18",
    end: "2015-08-25",
    viewStart: "2015-07-01",
    viewEnd: "2015-10-31",
  },
];

const money = (value: number) => `$${value.toFixed(2)}`;
const percent = (value: number) =>
  `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
const label = (symbol: Symbol) => (symbol === "GSPC" ? "S&P 500" : symbol);
const formatDate = (date: string, short = false) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    day: short ? undefined : "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function getMetrics(values: number[]) {
  const returns = values
    .slice(1)
    .map((value, index) => value / values[index] - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const volatility =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
            (returns.length - 1),
        ) * Math.sqrt(252)
      : null;
  let peak = values[0];
  let drawdown = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, value / peak - 1);
  }
  // Annualized return, assuming 252 trading days per year.
  // Skipped for ranges shorter than ~1 month (annualizing a few days is noise).
  const years = returns.length / 252;
  const total = values[values.length - 1] / values[0];
  return {
    change: total - 1,
    ending: 100 * total,
    cagr: years >= 1 / 12 ? total ** (1 / years) - 1 : null,
    best: returns.length ? Math.max(...returns) : 0,
    worst: returns.length ? Math.min(...returns) : 0,
    volatility,
    drawdown,
  };
}

export function UpdatedVisual() {
  const tooltipId = useId();
  const [selected, setSelected] = useState<Symbol[]>(["AAPL", "MSFT", "GSPC"]);
  const [start, setStart] = useState("2015-03-01");
  const [end, setEnd] = useState("2016-03-01");
  const [preset, setPreset] = useState("12");
  const [day, setDay] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [sliderFocused, setSliderFocused] = useState(false);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [scale, setScale] = useState<"linear" | "log">("linear");
  const [focus, setFocus] = useState<Symbol | null>(null);
  const [previousView, setPreviousView] = useState<View | null>(null);
  const drag = useRef<{
    pointerId: number;
    start: number;
    x: number;
  } | null>(null);
  const visible = useMemo(
    () => rows.filter((row) => row.date >= start && row.date <= end),
    [start, end],
  );
  const series = useMemo(
    () =>
      visible.length < 2
        ? []
        : selected.map((symbol) => ({
            symbol,
            values: visible.map(
              (row) => (100 * row[symbol]) / visible[0][symbol],
            ),
            metrics: getMetrics(visible.map((row) => row[symbol])),
          })),
    [visible, selected],
  );
  const allValues = series.flatMap((item) => item.values);
  const low = allValues.length ? Math.min(...allValues, 100) : 1;
  const high = allValues.length ? Math.max(...allValues, 100) : 100;
  const padding = (high - low) * 0.15 || 1;
  const x = scaleLinear()
    .domain([0, Math.max(1, visible.length - 1)])
    .range([72, 1055]);
  const y: ScaleContinuousNumeric<number, number> =
    scale === "log"
      ? scaleLog()
          .domain([Math.max(0.01, low * 0.92), high * 1.08])
          .nice()
          .range([342, 28])
      : scaleLinear()
          .domain([low - padding, high + padding])
          .nice(5)
          .range([342, 28]);
  const activeDay = Math.min(
    day ?? Math.max(0, visible.length - 1),
    Math.max(0, visible.length - 1),
  );
  const error = !selected.length
    ? "Select at least one asset to start comparing."
    : !start || !end
      ? "Choose both a start date and an end date."
      : start > end
        ? "The start date must come before the end date."
        : visible.length < 2
          ? "Choose a range with at least two trading days."
          : "";
  const showTooltip = !error && !selection && (hovering || sliderFocused);
  const ticks = [
    ...new Set(
      [0, 1, 2, 3, 4].map((tick) =>
        Math.round(((visible.length - 1) * tick) / 4),
      ),
    ),
  ];

  // Event bands that fall inside the visible range
  const bands = events.flatMap((event) => {
    const first = visible.findIndex((row) => row.date >= event.start);
    let last = -1;
    visible.forEach((row, index) => {
      if (row.date <= event.end) last = index;
    });
    return first >= 0 && last >= first ? [{ ...event, first, last }] : [];
  });

  function resetDay() {
    setDay(null);
    setHovering(false);
    drag.current = null;
    setSelection(null);
  }

  function chartPoint(event: PointerEvent<SVGSVGElement>) {
    const point = event.currentTarget.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = event.currentTarget.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : null;
  }

  function tradingDay(position: number) {
    return Math.max(
      0,
      Math.min(visible.length - 1, Math.round(x.invert(position))),
    );
  }

  function cancelSelection() {
    drag.current = null;
    setSelection(null);
    setHovering(false);
  }

  function resetView() {
    if (!previousView) return;
    setStart(previousView.start);
    setEnd(previousView.end);
    setPreset(previousView.preset);
    setPreviousView(null);
    resetDay();
  }

  function selectPeriod(value: string) {
    const anchor = end || rows[rows.length - 1].date;
    const date = new Date(`${anchor}T12:00:00Z`);
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - (Number(value) || 0));
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDay));
    setStart(
      value === "all"
        ? rows[0].date
        : [rows[0].date, date.toISOString().slice(0, 10)].sort()[1],
    );
    setEnd(anchor);
    setPreset(value);
    setPreviousView(null);
    resetDay();
  }

  function selectEvent(event: (typeof events)[number]) {
    const first = rows[0].date;
    const last = rows[rows.length - 1].date;
    // Remember where the user was so "Reset view" can take them back
    setPreviousView((current) => current ?? { start, end, preset });
    setStart(event.viewStart < first ? first : event.viewStart);
    setEnd(event.viewEnd > last ? last : event.viewEnd);
    setPreset("");
    resetDay();
  }

  const dim = (symbol: Symbol) => (focus && focus !== symbol ? 0.15 : 1);

  return (
    <main className="stock10">
      <div className="stock10-content">
        <header className="stock10-header">
          <div>
            <p className="stock10-eyebrow">WEEK 10 / MARKET EXPLORER</p>
            <h1>Stock performance, in perspective.</h1>
            <p className="stock10-intro">
              One starting point. Different journeys. Compare how $100 changes
              over time.
            </p>
          </div>
          <a
            className="stock10-download"
            href={datasetUrl}
            download="stocks.csv"
          >
            <span aria-hidden="true">↓</span> Download data
          </a>
        </header>

        <section
          className="stock10-card stock10-controls"
          aria-label="Comparison controls"
        >
          <fieldset>
            <legend>Build your comparison</legend>
            <div className="stock10-choices">
              {symbols.map((symbol) => (
                <label
                  key={symbol}
                  className={selected.includes(symbol) ? "is-selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(symbol)}
                    onChange={() => {
                      setSelected((current) =>
                        current.includes(symbol)
                          ? current.filter((item) => item !== symbol)
                          : [...current, symbol],
                      );
                      setHovering(false);
                    }}
                  />
                  <span
                    className="stock10-dot"
                    style={{ background: assets[symbol].color }}
                  />
                  <span>{label(symbol)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="stock10-dates">
            <label>
              From
              <input
                type="date"
                min={rows[0].date}
                max={rows[rows.length - 1].date}
                value={start}
                onChange={(event) => {
                  setStart(event.target.value);
                  setPreset("");
                  setPreviousView(null);
                  resetDay();
                }}
              />
            </label>
            <span aria-hidden="true">→</span>
            <label>
              To
              <input
                type="date"
                min={rows[0].date}
                max={rows[rows.length - 1].date}
                value={end}
                onChange={(event) => {
                  setEnd(event.target.value);
                  setPreset("");
                  setPreviousView(null);
                  resetDay();
                }}
              />
            </label>
          </div>
        </section>

        <section
          className="stock10-card stock10-panel"
          aria-labelledby="stock10-chart-title"
        >
          <div className="stock10-section-heading">
            <div>
              <p className="stock10-eyebrow">THE BIG PICTURE</p>
              <h2 id="stock10-chart-title">Growth of $100</h2>
              <p className="stock10-muted">
                {!error
                  ? `${formatDate(visible[0].date)} – ${formatDate(visible[visible.length - 1].date)} · ${visible.length.toLocaleString()} trading days`
                  : "Choose your assets and date range above."}
              </p>
            </div>
            <div className="stock10-chart-actions">
              <button
                className="stock10-reset"
                type="button"
                disabled={!previousView}
                onClick={resetView}
              >
                Reset view
              </button>
              <div
                className="stock10-presets"
                role="group"
                aria-label="Time period"
              >
                {[
                  ["1", "1M"],
                  ["6", "6M"],
                  ["12", "1Y"],
                  ["all", "All"],
                ].map(([value, name]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={preset === value}
                    onClick={() => selectPeriod(value)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div
                className="stock10-presets"
                role="group"
                aria-label="Market events"
              >
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => selectEvent(event)}
                  >
                    {event.button}
                  </button>
                ))}
              </div>
              <div
                className="stock10-presets"
                role="group"
                aria-label="Y-axis scale"
              >
                {(["linear", "log"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={scale === option}
                    onClick={() => setScale(option)}
                  >
                    {option === "linear" ? "Linear" : "Log"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error ? (
            <div className="stock10-empty" role="status">
              <span aria-hidden="true">↗</span>
              <h3>Let’s find a comparison.</h3>
              <p>{error}</p>
            </div>
          ) : (
            <>
              <div
                className="stock10-chart-frame"
                onPointerLeave={() => setHovering(false)}
              >
                <div className="stock10-chart-scroll">
                  <svg
                    className="stock10-chart"
                    viewBox="0 0 1100 390"
                    role="img"
                    aria-label="Line chart comparing the growth of 100 dollars. Drag across the chart to select a date range. Use the date fields to select a range with the keyboard, or the trading day slider for details."
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelSelection();
                    }}
                    onPointerDown={(event) => {
                      if (!event.isPrimary || event.button !== 0) return;
                      const point = chartPoint(event);
                      if (
                        !point ||
                        point.x < 72 ||
                        point.x > 1055 ||
                        point.y < 28 ||
                        point.y > 342
                      )
                        return;
                      event.preventDefault();
                      event.currentTarget.focus({ preventScroll: true });
                      event.currentTarget.setPointerCapture(event.pointerId);
                      const index = tradingDay(point.x);
                      drag.current = {
                        pointerId: event.pointerId,
                        start: index,
                        x: point.x,
                      };
                      setSelection([index, index]);
                      setHovering(false);
                    }}
                    onPointerMove={(event) => {
                      const point = chartPoint(event);
                      if (!point) return;
                      if (drag.current) {
                        if (drag.current.pointerId === event.pointerId) {
                          setSelection([
                            drag.current.start,
                            tradingDay(point.x),
                          ]);
                        }
                        return;
                      }
                      if (
                        point.x < 72 ||
                        point.x > 1055 ||
                        point.y < 28 ||
                        point.y > 342
                      ) {
                        setHovering(false);
                        return;
                      }
                      setDay(tradingDay(point.x));
                      setHovering(true);
                    }}
                    onPointerUp={(event) => {
                      if (drag.current?.pointerId !== event.pointerId) return;
                      const point = chartPoint(event);
                      if (point && Math.abs(point.x - drag.current.x) >= 5) {
                        const first = Math.min(
                          drag.current.start,
                          tradingDay(point.x),
                        );
                        const last = Math.max(
                          drag.current.start,
                          tradingDay(point.x),
                        );
                        if (first !== last) {
                          setPreviousView(
                            (current) => current ?? { start, end, preset },
                          );
                          setStart(visible[first].date);
                          setEnd(visible[last].date);
                          setPreset("");
                          resetDay();
                        }
                      }
                      cancelSelection();
                      event.currentTarget.releasePointerCapture(
                        event.pointerId,
                      );
                    }}
                    onPointerCancel={cancelSelection}
                    onLostPointerCapture={cancelSelection}
                  >
                    {y.ticks(5).map((tick) => (
                      <g key={tick}>
                        <line
                          x1="72"
                          x2="1055"
                          y1={y(tick)}
                          y2={y(tick)}
                          stroke="#e8edf4"
                        />
                        <text
                          x="57"
                          y={y(tick) + 5}
                          textAnchor="end"
                          fill="#64748b"
                          fontSize="13"
                        >
                          ${tick.toFixed(0)}
                        </text>
                      </g>
                    ))}
                    {bands.map((band) => (
                      <g key={band.id}>
                        <rect
                          x={x(band.first)}
                          y="28"
                          width={Math.max(3, x(band.last) - x(band.first))}
                          height="314"
                          fill="#f59e0b"
                          opacity="0.12"
                        />
                        <text
                          x={x(band.first) + 4}
                          y="44"
                          fontSize="12"
                          fill="#b45309"
                        >
                          {band.label}
                        </text>
                      </g>
                    ))}
                    <line
                      x1="72"
                      x2="1055"
                      y1={y(100)}
                      y2={y(100)}
                      stroke="#94a3b8"
                      strokeDasharray="4 5"
                    />
                    {ticks.map((index) => (
                      <text
                        key={index}
                        x={x(index)}
                        y="375"
                        textAnchor={
                          index === 0
                            ? "start"
                            : index === visible.length - 1
                              ? "end"
                              : "middle"
                        }
                        fill="#64748b"
                        fontSize="13"
                      >
                        {formatDate(visible[index].date, true)}
                      </text>
                    ))}
                    {series.map((item) => (
                      <path
                        key={item.symbol}
                        d={item.values
                          .map(
                            (value, index) =>
                              `${index ? "L" : "M"}${x(index)},${y(value)}`,
                          )
                          .join(" ")}
                        fill="none"
                        stroke={assets[item.symbol].color}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={
                          item.symbol === "GSPC" ? "7 6" : undefined
                        }
                        opacity={dim(item.symbol)}
                        style={{ transition: "opacity 0.15s" }}
                      />
                    ))}
                    <line
                      x1={x(activeDay)}
                      x2={x(activeDay)}
                      y1="28"
                      y2="342"
                      stroke="#94a3b8"
                      strokeDasharray="3 5"
                    />
                    {series.map((item) => (
                      <circle
                        key={item.symbol}
                        cx={x(activeDay)}
                        cy={y(item.values[activeDay])}
                        r={showTooltip ? 5 : 3.5}
                        fill={assets[item.symbol].color}
                        stroke="white"
                        strokeWidth="2"
                        opacity={dim(item.symbol)}
                        style={{ transition: "opacity 0.15s" }}
                      />
                    ))}
                    {selection && (
                      <rect
                        className="stock10-selection"
                        x={x(Math.min(...selection))}
                        y="28"
                        width={Math.abs(x(selection[1]) - x(selection[0]))}
                        height="314"
                      />
                    )}
                  </svg>
                </div>
                {showTooltip && (
                  <div
                    id={tooltipId}
                    role="tooltip"
                    className={`stock10-tooltip ${activeDay < visible.length / 2 ? "stock10-tooltip-right" : ""}`}
                  >
                    <p className="stock10-tooltip-date">
                      {formatDate(visible[activeDay].date)}
                    </p>
                    <p className="stock10-tooltip-hint">
                      Value of your starting $100
                    </p>
                    {series.map((item) => (
                      <div className="stock10-tooltip-row" key={item.symbol}>
                        <span>
                          <i
                            className="stock10-dot"
                            style={{ background: assets[item.symbol].color }}
                          />
                          {label(item.symbol)}
                        </span>
                        <strong>
                          {money(item.values[activeDay])}
                          <small
                            className={
                              item.values[activeDay] >= 100
                                ? "stock10-positive"
                                : "stock10-negative"
                            }
                          >
                            {percent(item.values[activeDay] / 100 - 1)}
                          </small>
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="stock10-explore">
                <div>
                  <label htmlFor={`${tooltipId}-slider`}>
                    Explore a trading day
                  </label>
                  <span>{formatDate(visible[activeDay].date)}</span>
                </div>
                <input
                  id={`${tooltipId}-slider`}
                  aria-describedby={showTooltip ? tooltipId : undefined}
                  aria-valuetext={formatDate(visible[activeDay].date)}
                  type="range"
                  min="0"
                  max={visible.length - 1}
                  value={activeDay}
                  onFocus={() => setSliderFocused(true)}
                  onBlur={() => setSliderFocused(false)}
                  onChange={(event) => setDay(Number(event.target.value))}
                />
                <p>
                  {selection
                    ? `Selected: ${formatDate(visible[Math.min(...selection)].date)} – ${formatDate(visible[Math.max(...selection)].date)}. Release to zoom, or press Escape to cancel.`
                    : "Drag across the chart to zoom into a date range. Hover or use the slider and arrow keys for exact values."}
                </p>
              </div>
              <div
                className="stock10-readout"
                aria-label="Values on the selected trading day"
              >
                {series.map((item) => (
                  <div
                    key={item.symbol}
                    tabIndex={0}
                    onMouseEnter={() => setFocus(item.symbol)}
                    onMouseLeave={() => setFocus(null)}
                    onFocus={() => setFocus(item.symbol)}
                    onBlur={() => setFocus(null)}
                  >
                    <span>
                      <i
                        className="stock10-dot"
                        style={{ background: assets[item.symbol].color }}
                      />
                      {assets[item.symbol].name}
                    </span>
                    <strong>{money(item.values[activeDay])}</strong>
                    <small
                      className={
                        item.values[activeDay] >= 100
                          ? "stock10-positive"
                          : "stock10-negative"
                      }
                    >
                      {percent(item.values[activeDay] / 100 - 1)}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section
          className="stock10-card stock10-results"
          aria-labelledby="stock10-results-title"
        >
          <div className="stock10-section-heading">
            <div>
              <p className="stock10-eyebrow">BY THE NUMBERS</p>
              <h2 id="stock10-results-title">Period performance</h2>
              <p className="stock10-muted">
                Results for your full selected date range. Annualized figures
                assume 252 trading days per year.
              </p>
            </div>
            <span className="stock10-badge">Starting value · $100</span>
          </div>
          {!error ? (
            <div className="stock10-table-scroll">
              <table>
                <caption className="stock10-sr-only">
                  Performance and risk of the selected assets over the full date
                  range
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Asset</th>
                    <th scope="col">Period change</th>
                    <th scope="col">Annualized return</th>
                    <th scope="col">$100 becomes</th>
                    <th scope="col">Annualized volatility</th>
                    <th scope="col">Largest drawdown</th>
                    <th scope="col">Best day</th>
                    <th scope="col">Worst day</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map(({ symbol, metrics }) => (
                    <tr
                      key={symbol}
                      onMouseEnter={() => setFocus(symbol)}
                      onMouseLeave={() => setFocus(null)}
                    >
                      <th scope="row">
                        <span className="stock10-asset">
                          <i
                            className="stock10-dot"
                            style={{ background: assets[symbol].color }}
                          />
                          <span>
                            {label(symbol)}
                            <small>{assets[symbol].name}</small>
                          </span>
                        </span>
                      </th>
                      <td
                        className={
                          metrics.change >= 0
                            ? "stock10-positive"
                            : "stock10-negative"
                        }
                      >
                        {percent(metrics.change)}
                      </td>
                      <td>
                        {metrics.cagr === null ? "n.a." : percent(metrics.cagr)}
                      </td>
                      <td className="stock10-ending">{money(metrics.ending)}</td>
                      <td>
                        {metrics.volatility === null
                          ? "n.a."
                          : `${(metrics.volatility * 100).toFixed(2)}%`}
                      </td>
                      <td>{percent(metrics.drawdown)}</td>
                      <td className="stock10-positive">
                        {percent(metrics.best)}
                      </td>
                      <td className="stock10-negative">
                        {percent(metrics.worst)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="stock10-muted">
              Your results will appear once a valid comparison is selected.
            </p>
          )}
        </section>
        <footer className="stock10-footer">
          <span>Historical dataset · Jan 2007 – Mar 2016</span>
          <span>
            Each series is rebased to $100 at the first selected trading day.
          </span>
        </footer>
      </div>
    </main>
  );
}

export default UpdatedVisual;