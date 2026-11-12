"use client";
import { COLOURS } from "@/lib/stationery-colours";

export default function ColourSelect({ kind, value, onChange, label = "Colour", required = false }: { kind: string; value: string; onChange: (value: string) => void; label?: string; required?: boolean }) {
  const choices = COLOURS[kind];
  if (!choices) return null;
  const other = !!value && !choices.filter(colour => colour !== "Other").includes(value);
  return <div className="colour-fields"><label className="field"><span>{label}{required ? " *" : ""}</span><select required={required} value={other ? "Other" : value} onChange={event => onChange(event.target.value)}><option value="">Select colour</option>{choices.map(colour => <option key={colour}>{colour}</option>)}</select></label>{other && <label className="field"><span>Other colour *</span><input required maxLength={60} value={value === "Other" ? "" : value} onChange={event => onChange(event.target.value || "Other")} placeholder="Enter colour"/></label>}</div>;
}
