"use client";

import { useState, useTransition } from "react";
import { findPlaces } from "@/app/actions/shops";
import { CheckIcon, PinIcon, SearchIcon } from "@/components/ui/Icon";
import type { Place } from "@/lib/api/nominatim";

/**
 * A shop is its OpenStreetMap reference, so it is picked here rather than
 * typed: the address, the coordinates and the identity all arrive together and
 * two people adding the same cheesemonger land on one row. See ADR 0002.
 *
 * The search fires on a button rather than on every keystroke. Nominatim allows
 * one request per second, and a debounce that is generous enough to respect
 * that is slow enough to feel broken — an explicit press is honest about it.
 */
export function PlacePicker({ error }: { error?: string | undefined }) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [chosen, setChosen] = useState<Place | null>(null);
  const [complaint, setComplaint] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const search = () => {
    if (query.trim().length < 3) {
      setComplaint("Trois lettres au minimum pour chercher.");
      return;
    }
    setComplaint(null);
    startSearch(async () => {
      const answer = await findPlaces(query);
      if (answer.status === "error") {
        setComplaint(answer.message);
        setPlaces(null);
        return;
      }
      setPlaces(answer.places);
      setChosen(null);
    });
  };

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="label-mono pb-1">Le lieu, dans OpenStreetMap</legend>

      <div className="flex gap-2">
        <div className="flex h-11 grow items-center gap-2.5 rounded-card border border-rule bg-white px-3.5">
          <SearchIcon className="shrink-0 text-mute" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter would otherwise submit the shop form with no place chosen.
              if (event.key === "Enter") {
                event.preventDefault();
                search();
              }
            }}
            placeholder="Fromagerie Beaufils Paris"
            aria-label="Chercher un lieu dans OpenStreetMap"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-mute-2"
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="h-11 shrink-0 rounded-card border border-ink px-4 text-sm font-semibold disabled:opacity-60"
        >
          {searching ? "…" : "Chercher"}
        </button>
      </div>

      {/* The chosen place is what the action reads; the list above is only a way
          to fill it, so nothing is submitted until one is picked. */}
      <input
        type="hidden"
        name="place"
        value={
          chosen === null
            ? ""
            : JSON.stringify({
                name: chosen.name,
                street: chosen.street,
                postalCode: chosen.postalCode,
                city: chosen.city,
                countryCode: chosen.countryCode,
                latitude: chosen.latitude,
                longitude: chosen.longitude,
                osm: chosen.osm,
              })
        }
      />

      {places !== null && places.length === 0 ? (
        <p className="rounded-card border border-dashed border-rule-strong px-4 py-5 text-center text-[13px] text-ink-2 text-pretty">
          Rien d’exploitable sous ce nom. Une boutique absente d’OpenStreetMap doit d’abord y être
          ajoutée.
        </p>
      ) : null}

      {places !== null && places.length > 0 ? (
        <ul className="flex flex-col overflow-hidden rounded-card border border-rule bg-white">
          {places.map((place) => {
            const on = chosen?.key === place.key;
            return (
              <li key={place.key} className="border-b border-rule last:border-b-0">
                <button
                  type="button"
                  onClick={() => setChosen(place)}
                  aria-pressed={on}
                  className={`flex w-full items-start gap-2.5 px-3.5 py-3 text-left ${
                    on ? "bg-cream" : ""
                  }`}
                >
                  <PinIcon className="mt-0.5 shrink-0 text-pine" size={15} />
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="text-[15px] font-semibold leading-tight">{place.name}</span>
                    <span className="font-mono text-[11px] leading-normal text-mute">
                      {place.address}
                    </span>
                  </span>
                  {on ? <CheckIcon className="mt-1 shrink-0 text-link" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {(complaint ?? error) ? (
        <p className="text-[13px] text-refusal">{complaint ?? error}</p>
      ) : (
        <p className="font-mono text-[11px] text-mute-2">
          Cherchez par nom et par ville · données © contributeurs OpenStreetMap
        </p>
      )}
    </fieldset>
  );
}
