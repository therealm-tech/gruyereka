"use client";

import { useEffect, useId, useState } from "react";
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

type Preview = { file: File; url: string };

/**
 * The chosen files live in the parent's state rather than in the input, which
 * only ever holds the last pick: several picks add up, and one photo can be
 * taken back without the others. The parent appends them to the form data on
 * submit. Refusing a file here rather than after the round trip means a visit
 * is never saved only to have its photos bounce.
 */
export function PhotoPicker({
  files,
  onChange,
  max,
  error,
}: {
  files: readonly File[];
  onChange: (files: File[]) => void;
  /** How many photos may still be added. */
  max: number;
  error?: string | undefined;
}) {
  const inputId = useId();
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [refusals, setRefusals] = useState<string[]>([]);

  useEffect(() => {
    const made = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(made);
    return () => {
      for (const one of made) URL.revokeObjectURL(one.url);
    };
  }, [files]);

  const choose = (chosen: readonly File[]) => {
    const accepted: File[] = [];
    const why: string[] = [];
    let left = max - files.length;
    for (const file of chosen) {
      const refusal = refuse(file);
      if (refusal !== null) {
        why.push(`${file.name} : ${refusal}`);
      } else if (left <= 0) {
        why.push(`${file.name} : ${max} photos au plus pour cette visite.`);
      } else {
        accepted.push(file);
        left -= 1;
      }
    }
    setRefusals(why);
    if (accepted.length > 0) onChange([...files, ...accepted]);
  };

  const remove = (file: File) => {
    setRefusals([]);
    onChange(files.filter((one) => one !== file));
  };

  const full = files.length >= max;
  const complaints = refusals.length > 0 ? refusals : error === undefined ? [] : [error];

  return (
    <div className="flex flex-col gap-3">
      {previews.length === 0 ? null : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {previews.map(({ file, url }) => (
            <li key={url} className="flex flex-col gap-1.5">
              {/* biome-ignore lint/performance/noImgElement: a local object URL; next/image cannot optimise what never left the browser. */}
              <img
                src={url}
                alt={`Aperçu de ${file.name}`}
                className="aspect-square w-full rounded-card border border-rule object-cover"
              />
              <span className="truncate font-mono text-[10px] text-mute">
                {readableSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => remove(file)}
                aria-label={`Retirer ${file.name}`}
                className="self-start text-[13px] font-semibold text-link"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? null : (
        <>
          <input
            id={inputId}
            type="file"
            multiple
            accept={ACCEPTED_PHOTO_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => {
              choose([...(event.target.files ?? [])]);
              // Cleared so that picking the same file again still fires a change.
              event.target.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className={`flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-card border border-dashed bg-white px-5 text-center ${
              complaints.length === 0 ? "border-rule-strong" : "border-refusal"
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
              {files.length === 0 ? "Choisir des photos" : "Ajouter d’autres photos"}, ou{" "}
              <span className="font-semibold text-link">parcourir</span>
            </span>
          </label>
        </>
      )}

      {complaints.length === 0 ? (
        <p className="font-mono text-[11px] text-mute-2">
          JPEG, PNG ou WebP · {readableSize(MAX_PHOTO_BYTES)} au maximum · {files.length} sur {max}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {complaints.map((complaint) => (
            <li key={complaint} className="text-[13px] text-refusal">
              {complaint}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
