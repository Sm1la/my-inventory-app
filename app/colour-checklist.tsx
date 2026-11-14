"use client";
import { useId } from "react";

export default function ColourChecklist({ label, choices, values, onChange, details = {} }: { label: string; choices: readonly string[]; values: Record<string,string>; onChange: (colour: string, quantity: string | null) => void; details?: Record<string,string> }) {
  const id = useId();
  return <fieldset className="colour-checklist"><legend>{label} — tick colours and enter quantities</legend>{choices.map(colour => {
    const checked = values[colour] !== undefined;
    return <div className="colour-check-row" key={colour}><label htmlFor={id + colour}>{colour}{details[colour] && <small>{details[colour]}</small>}</label><input className="request-line-qty" type="number" min={1} max={10000000} step={1} required={checked} disabled={!checked} value={values[colour] ?? "1"} aria-label={"Quantity for " + label + " " + colour} onChange={event => onChange(colour,event.target.value)}/><input id={id + colour} type="checkbox" aria-label={"Select " + label + " " + colour} checked={checked} onChange={event => onChange(colour,event.target.checked ? "1" : null)}/></div>;
  })}</fieldset>;
}
