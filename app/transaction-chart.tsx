"use client";
import { useState } from "react";

type ChartMovement = { kind: string; transaction_date: string };
export function summarizeMovements(movements: ChartMovement[], grouping: "day" | "month" | "year") {
  const totals = new Map<string, { period: string; received: number; issued: number }>();
  for (const movement of movements) {
    const period = movement.transaction_date.slice(0, grouping === "year" ? 4 : grouping === "month" ? 7 : 10);
    const point = totals.get(period) || { period, received: 0, issued: 0 };
    if (movement.kind === "received") point.received++;
    if (movement.kind === "issued") point.issued++;
    totals.set(period, point);
  }
  return [...totals.values()].sort((a, b) => a.period.localeCompare(b.period));
}
export default function TransactionChart({ movements }: { movements: ChartMovement[] }) {
  const [grouping, setGrouping] = useState<"day" | "month" | "year">("month");
  const points = summarizeMovements(movements, grouping);
  const received = points.reduce((sum, point) => sum + point.received, 0);
  const issued = points.reduce((sum, point) => sum + point.issued, 0);
  const peak = Math.max(1, ...points.flatMap(point => [point.received, point.issued]));
  function label(period: string) {
    if (grouping === "year") return period;
    return new Date(period + (grouping === "month" ? "-01" : "") + "T00:00:00").toLocaleDateString("en-MY", grouping === "month" ? { month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
  }
  return <section className="transaction-chart" aria-label="Transaction graph">
    <div className="transaction-chart-heading"><div><h3>Received &amp; issued</h3><p>Number of transactions over time</p></div><label>Group by<select aria-label="Graph grouping" value={grouping} onChange={event => setGrouping(event.target.value as "day" | "month" | "year")}><option value="year">Year</option><option value="month">Month</option><option value="day">Day</option></select></label></div>
    <div className="transaction-legend"><span><i className="received-key"/>Received <strong>{received}</strong></span><span><i className="issued-key"/>Issued <strong>{issued}</strong></span><span>Total <strong>{movements.length}</strong></span></div>
    {points.length ? <figure><div className="transaction-chart-scroll" tabIndex={0} role="region" aria-label="Scrollable received and issued graph"><div className="transaction-bars">{points.map(point => <div className="transaction-period" key={point.period}><div className="transaction-bar-pair" role="img" aria-label={label(point.period) + ": " + point.received + " received transactions, " + point.issued + " issued transactions"}><div className="transaction-bar received-key" style={{ height: (point.received / peak * 160) + "px" }}><span>{point.received}</span></div><div className="transaction-bar issued-key" style={{ height: (point.issued / peak * 160) + "px" }}><span>{point.issued}</span></div></div><span className="transaction-period-label">{label(point.period)}</span></div>)}</div></div><figcaption>Periods with activity · Follows the date and search filters. Each receipt or issue counts once; item quantities remain in their own units in the table below.</figcaption></figure> : <div className="transaction-chart-empty"><strong>No transactions to graph</strong><p>Receive or issue stock, or adjust the filters to view existing movements.</p></div>}
  </section>;
}
