"use client";

import { useEffect, useRef, useState } from "react";
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/api/schemas";

const MEGABYTE = 1024 * 1024;

function readableSize(bytes: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
    bytes / MEGABYTE,
  )} Mo`;
}

function refuse(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type as (typeof ACCEPTED_PHOTO_TYPES)[number])) {
    return "Seuls le JPEG, le PNG et le WebP sont acceptés.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `Cette image fait ${readableSize(file.size)}, au-delà des ${readableSize(MAX_PHOTO_BYTES)} acceptés.`;
  }
  return null;
}

/**
 * The photo is optional and goes up as a second call, once the cheese exists.
 * Refusing a file here rather than after the round trip means a cheese is never
 * created only to have its photo bounce.
 */
export function PhotoPicker({ error }: { error?: string | undefined }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (chosen: File | null) => {
    if (chosen === null) {
      setFile(null);
      setRefusal(null);
      return;
    }
    const why = refuse(chosen);
    setRefusal(why);
    setFile(why === null ? chosen : null);
    if (why !== null && input.current !== null) input.current.value = "";
  };

  const clear = () => {
    if (input.current !== null) input.current.value = "";
    choose(null);
  };

  const complaint = refusal ?? error ?? null;

  return (
    <aside className="flex h-fit w-full flex-col gap-4 rounded-card border border-rule bg-white p-5 lg:w-[400px]">
      <h2 className="label-mono">La photo</h2>
      <p className="text-sm leading-relaxed text-ink-3 text-pretty">
        Facultative, et elle peut venir plus tard. Une part sur une planche en dit plus qu’une
        étiquette.
      </p>

      <input
        ref={input}
        id="cheese-photo"
        name="photo"
        type="file"
        accept={ACCEPTED_PHOTO_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
      />

      {preview === null ? (
        <label
          htmlFor="cheese-photo"
          className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-card border border-dashed px-5 text-center ${
            complaint === null ? "border-rule-strong" : "border-refusal"
          }`}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-mute-2"
          >
            <path d="M3 8h4l1.5-2.5h7L17 8h4v11H3Z" />
            <circle cx="12" cy="13" r="3.6" />
          </svg>
          <span className="text-sm text-ink-2">
            Choisir une photo, ou <span className="font-semibold text-link">parcourir</span>
          </span>
        </label>
      ) : (
        <figure className="flex flex-col gap-3">
          {/* biome-ignore lint/performance/noImgElement: a local object URL; next/image cannot optimise what never left the browser. */}
          <img
            src={preview}
            alt="Aperçu du fichier choisi"
            className="max-h-[260px] w-full rounded-card border border-rule object-cover"
          />
          <figcaption className="flex items-center justify-between gap-3">
            <span className="truncate font-mono text-[11px] text-mute">
              {file === null ? "" : `${file.name} · ${readableSize(file.size)}`}
            </span>
            <button type="button" onClick={clear} className="text-sm font-semibold text-link">
              Retirer
            </button>
          </figcaption>
        </figure>
      )}

      {complaint === null ? (
        <p className="font-mono text-[11px] text-mute-2">
          JPEG, PNG ou WebP · {readableSize(MAX_PHOTO_BYTES)} au maximum
        </p>
      ) : (
        <p className="text-[13px] text-refusal">{complaint}</p>
      )}
    </aside>
  );
}
