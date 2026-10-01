import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import rawData from './stocks.csv?raw';
import datasetUrl from './stocks.csv?url';
import './project1.css';

const assets = {
  AAPL: { name: 'Apple', color: '#16752b' },
  MSFT: { name: 'Microsoft', color: '#2255cc' },
  IBM: { name: 'IBM', color: '#9933aa' },
  SBUX: { name: 'Starbucks', color: '#b55d00' },
  GSPC: { name: 'S&P 500', color: '#555555' },
};

type Symbol = keyof typeof assets;
type Row = { date: string } & Record<Symbol, number>;
const symbols = Object.keys(assets) as Symbol[];
const rows: Row[] = rawData.trim().split(/\r?\n/).slice(1).map((line) => {
  const [MSFT, IBM, SBUX, AAPL, GSPC, date] = line.replaceAll('"', '').split(',');
  return { date, MSFT: Number(MSFT), IBM: Number(IBM), SBUX: Number(SBUX), AAPL: Number(AAPL), GSPC: Number(GSPC) };
});
const money = (value: number) => `$${value.toFixed(2)}`;
const percent = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

function getMetrics(values: number[]) {
  const returns = values.slice(1).map((value, index) => value / values[index] - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const volatility = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)) * Math.sqrt(252)
    : null;
  let peak = values[0];
  let drawdown = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, value / peak - 1);
  }
  return { change: values[values.length - 1] / values[0] - 1, ending: 100 * values[values.length - 1] / values[0], volatility, drawdown };
}

export function Project1() {
  const [selected, setSelected] = useState<Symbol[]>(['AAPL', 'MSFT', 'GSPC']);
  const [start, setStart] = useState('2015-03-01');
  const [end, setEnd] = useState('2016-03-01');
  const [preset, setPreset] = useState('12');
  const [day, setDay] = useState<number | null>(null);
  const visible = useMemo(() => rows.filter((row) => row.date >= start && row.date <= end), [start, end]);
  const series = useMemo(() => visible.length < 2 ? [] : selected.map((symbol) => ({
    symbol,
    values: visible.map((row) => 100 * row[symbol] / visible[0][symbol]),
    metrics: getMetrics(visible.map((row) => row[symbol])),
  })), [visible, selected]);
  const allValues = series.flatMap((item) => item.values);
  const low = allValues.length ? Math.min(...allValues) : 0;
  const high = allValues.length ? Math.max(...allValues) : 100;
  const padding = (high - low) * 0.12 || 1;
  const x = scaleLinear().domain([0, Math.max(1, visible.length - 1)]).range([65, 1060]);
  const y = scaleLinear().domain([low - padding, high + padding]).range([310, 25]);
  const activeDay = Math.min(day ?? Math.max(0, visible.length - 1), Math.max(0, visible.length - 1));
  const error = !selected.length ? 'Select at least one asset.' : visible.length < 2 ? 'Choose a date range containing at least two trading days.' : '';

  function selectPeriod(value: string) {
    const date = new Date(`${end || rows[rows.length - 1].date}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - (Number(value) || 0));
    setStart(value === 'all' ? rows[0].date : [rows[0].date, date.toISOString().slice(0, 10)].sort()[1]);
    setPreset(value);
    setDay(null);
  }

  return (
    <div className="stock-project">
      <div className="stock-heading"><div><h1>Project 1 Demo of Stock</h1></div><a className="stock-download" href={datasetUrl} download="stocks.csv">Download dataset</a></div>
      <section className="stock-controls" aria-label="Comparison controls">
        <div><h2>Select stocks</h2><div className="stock-choices">{symbols.map((symbol) => <label key={symbol}><input type="checkbox" checked={selected.includes(symbol)} onChange={() => setSelected((current) => current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol])} /> {symbol === 'GSPC' ? 'S&P 500' : symbol}</label>)}</div></div>
        <div className="stock-dates"><label>From<input type="date" min={rows[0].date} max={rows[rows.length - 1].date} value={start} onChange={(event) => { setStart(event.target.value); setPreset(''); setDay(null); }} /></label><label>To<input type="date" min={rows[0].date} max={rows[rows.length - 1].date} value={end} onChange={(event) => { setEnd(event.target.value); setPreset(''); setDay(null); }} /></label></div>
      </section>
      <section className="stock-panel">
        <div className="stock-chart-heading"><div><h2>Growth of $100</h2><p>{!error && `${visible[0].date} to ${visible[visible.length - 1].date} · ${visible.length.toLocaleString()} trading days`}</p></div><div className="stock-presets">{[['1', '1M'], ['6', '6M'], ['12', '1Y'], ['all', 'All']].map(([value, label]) => <button key={value} type="button" aria-pressed={preset === value} onClick={() => selectPeriod(value)}>{label}</button>)}</div></div>
        {error ? <p className="stock-error" role="status">{error}</p> : <>
          <svg className="stock-chart" viewBox="0 0 1100 355" role="img" aria-label="Growth of 100 dollars for the selected assets. Use the trading day slider below to explore exact values." onPointerMove={(event) => {
            const point = event.currentTarget.createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            const matrix = event.currentTarget.getScreenCTM();
            if (matrix) setDay(Math.max(0, Math.min(visible.length - 1, Math.round(x.invert(point.matrixTransform(matrix.inverse()).x)))));
          }}>
            {y.ticks(5).map((tick) => <g key={tick}><line x1="65" x2="1060" y1={y(tick)} y2={y(tick)} stroke="#dddddd" /><text x="53" y={y(tick) + 4} textAnchor="end" fill="#444444" fontSize="14">${tick.toFixed(0)}</text></g>)}
            {[0, 1, 2, 3, 4].map((tick) => { const index = Math.round((visible.length - 1) * tick / 4); return <text key={tick} x={x(index)} y="342" textAnchor={tick === 0 ? 'start' : tick === 4 ? 'end' : 'middle'} fill="#444444" fontSize="14">{visible[index].date}</text>; })}
            {series.map((item) => <path key={item.symbol} d={item.values.map((value, index) => `${index ? 'L' : 'M'}${x(index)},${y(value)}`).join(' ')} fill="none" stroke={assets[item.symbol].color} strokeWidth="2.5" strokeDasharray={item.symbol === 'GSPC' ? '6 5' : undefined} />)}
            <line x1={x(activeDay)} x2={x(activeDay)} y1="25" y2="310" stroke="#666666" strokeOpacity="0.5" strokeDasharray="3 4" />
          </svg>
          <label className="stock-slider">Explore a trading day <span>{visible[activeDay].date}</span><input aria-label="Trading day" type="range" min="0" max={visible.length - 1} value={activeDay} onChange={(event) => setDay(Number(event.target.value))} /></label>
          <div className="stock-readout">{series.map((item) => <span key={item.symbol}><i style={{ background: assets[item.symbol].color }} />{item.symbol === 'GSPC' ? 'S&P 500' : item.symbol} <b>{money(item.values[activeDay])}</b></span>)}</div>
        </>}
      </section>
      <section className="stock-results"><h2>Results</h2><div className="stock-table"><table><thead><tr><th>Asset</th><th>Period change</th><th>$100 becomes</th><th>Annualized volatility</th><th>Largest drawdown</th></tr></thead><tbody>{!error && series.map(({ symbol, metrics }) => <tr key={symbol}><td><strong style={{ color: assets[symbol].color }}>{symbol === 'GSPC' ? 'S&P 500' : symbol}</strong><small>{assets[symbol].name}</small></td><td className={metrics.change >= 0 ? 'stock-positive' : 'stock-negative'}>{percent(metrics.change)}</td><td>{money(metrics.ending)}</td><td>{metrics.volatility === null ? 'n.a.' : `${(metrics.volatility * 100).toFixed(2)}%`}</td><td>{percent(metrics.drawdown)}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}

export default Project1;



