"use client";
import { useId } from "react";
import ItemPhoto from "./item-photo";

export default function ColourChecklist({ label, choices, values, onChange, details = {}, images = {}, instruction = "tick colours and enter quantities" }: { label: string; choices: readonly string[]; values: Record<string,string>; onChange: (colour: string, quantity: string | null) => void; details?: Record<string,string>; images?: Record<string,string|undefined>; instruction?: string }) {
  const id = useId();
  return <fieldset className="colour-checklist"><legend>{label} — {instruction}</legend>{choices.map(colour => {
    const checked = values[colour] !== undefined;
    return <div className="colour-check-row" key={colour}><div className="variant-photo-label">{images[colour] && <ItemPhoto name={label+" "+colour} category="Stationery" url={images[colour]}/>}<label htmlFor={id + colour}>{colour}{details[colour] && <small>{details[colour]}</small>}</label></div><input className="request-line-qty" type="number" min={1} max={10000000} step={1} required={checked} disabled={!checked} value={values[colour] ?? "1"} aria-label={"Quantity for " + label + " " + colour} onChange={event => onChange(colour,event.target.value)}/><input id={id + colour} type="checkbox" aria-label={"Select " + label + " " + colour} checked={checked} onChange={event => onChange(colour,event.target.checked ? "1" : null)}/></div>;
  })}</fieldset>;
}
