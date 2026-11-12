import { useEffect, useState } from "react";
import "./OlistPayments.css";

type PaymentTotal = { type: string; total: number };

export function OlistPayments() {
  const [data, setData] = useState<PaymentTotal[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/olist_order_payments_dataset.csv`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load payment data");
        return response.text();
      })
      .then((text) => {
        const totals = new Map<string, number>();
        for (const line of text.trim().split(/\r?\n/).slice(1)) {
          const fields = line.split(",");
          const type = fields[2]?.replaceAll('"', "").trim();
          const value = Number(fields[4]);
          if (type && fields[4]?.trim() && Number.isFinite(value)) {
            totals.set(type, (totals.get(type) ?? 0) + value);
          }
        }
        setData(Array.from(totals, ([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total));
      })
      .catch(() => setError("Could not load the Olist payments dataset."));
  }, []);

  const grandTotal = data.reduce((sum, item) => sum + item.total, 0);
  const max = Math.max(...data.map((item) => item.total), 0);
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <section className="olist-payments">
      <h1>Total Payment Value by Payment Type</h1>
      <p>Olist Brazilian e-commerce orders · Values in Brazilian reais (BRL)</p>
      {error && <p role="alert">{error}</p>}
      {!error && data.length === 0 && <p>Loading payment data...</p>}
      {data.length > 0 && (
        <div className="olist-chart" aria-label="Total payment value by payment type">
          {data.map(({ type, total }) => (
            <div className="olist-row" key={type}>
              <span className="olist-label">{type.replaceAll("_", " ")}</span>
              <div className="olist-track">
                <div className="olist-bar" style={{ width: `${max ? total / max * 100 : 0}%` }} title={`${type}: ${money.format(total)} (${grandTotal ? (total / grandTotal * 100).toFixed(1) : 0}%)`} />
              </div>
              <span className="olist-value">{money.format(total)} <small>({grandTotal ? (total / grandTotal * 100).toFixed(1) : 0}%)</small></span>
            </div>
          ))}
        </div>
      )}
      <p className="olist-note">Totals are calculated from payment records. Hover over a bar for details.</p>
    </section>
  );
}
