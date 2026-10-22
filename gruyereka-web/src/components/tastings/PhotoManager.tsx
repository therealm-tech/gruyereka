"use client";

import { useActionState, useEffect, useState } from "react";
import { IDLE } from "@/app/actions/state";
import { addTastingPhotos, removeTastingPhoto } from "@/app/actions/tastings";
import { PhotoPicker } from "@/components/tastings/PhotoPicker";
import { Notice } from "@/components/ui/Notice";
import { MAX_TASTING_PHOTOS, type TastingPhoto } from "@/lib/api/schemas";
import { photoPath } from "@/lib/photos";

/**
 * A visit's photos on its correction page. Each one is removed on its own, and
 * new ones go up as separate requests from the basket's form, so changing a
 * photo never resends the cheeses.
 */
export function PhotoManager({
  tastingId,
  photos,
}: {
  tastingId: string;
  photos: readonly TastingPhoto[];
}) {
  const [state, action, pending] = useActionState(addTastingPhotos, IDLE);
  const [chosen, setChosen] = useState<File[]>([]);
  const room = MAX_TASTING_PHOTOS - photos.length;

  // What landed now shows in the list above; what did not stays picked, so it
  // can be sent again. The action names the failures by their submitted index.
  useEffect(() => {
    if (state.status === "idle") {
      if (state !== IDLE) setChosen([]);
      return;
    }
    const failed = state.fields;
    if (failed === undefined || !Object.keys(failed).some((key) => key.startsWith("photos."))) {
      return;
    }
    setChosen((current) => current.filter((_, index) => failed[`photos.${index}`] !== undefined));
  }, [state]);

  const submit = (formData: FormData) => {
    for (const photo of chosen) formData.append("photos", photo, photo.name);
    action(formData);
  };

  return (
    <section className="flex w-full flex-col gap-4 border-t border-rule pt-6 lg:w-[680px]">
      <h2 className="label-mono">
        Les photos · {photos.length} sur {MAX_TASTING_PHOTOS}
      </h2>

      {photos.length === 0 ? (
        <p className="text-[13px] text-ink-2">Aucune photo pour cette visite.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex flex-col gap-1.5">
              <a href={photoPath(tastingId, photo.id)} target="_blank" rel="noopener">
                {/* biome-ignore lint/performance/noImgElement: the bucket serves these bytes behind a short-lived redirect. */}
                <img
                  src={photoPath(tastingId, photo.id)}
                  alt={`Vue ${index + 1} sur ${photos.length} de cette visite`}
                  loading="lazy"
                  className="aspect-square w-full rounded-card border border-rule object-cover"
                />
              </a>
              <form action={removeTastingPhoto}>
                <input type="hidden" name="tastingId" value={tastingId} />
                <input type="hidden" name="photoId" value={photo.id} />
                <button
                  type="submit"
                  aria-label={`Supprimer la photo ${index + 1}`}
                  className="text-[13px] font-semibold text-refusal-ink"
                >
                  Supprimer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {room <= 0 ? (
        <p className="font-mono text-[11px] text-mute-2">
          {MAX_TASTING_PHOTOS} photos au plus par visite : supprimez-en une pour en ajouter une
          autre.
        </p>
      ) : (
        <form action={submit} className="flex flex-col gap-3">
          {state.status === "error" ? (
            <Notice title="Des photos n’ont pas été ajoutées">{state.message}</Notice>
          ) : null}
          <input type="hidden" name="tastingId" value={tastingId} />
          <PhotoPicker files={chosen} onChange={setChosen} max={room} />
          {chosen.length === 0 ? null : (
            <button
              type="submit"
              disabled={pending}
              className="h-10 self-start rounded-card bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {pending ? "Envoi…" : `Ajouter ${chosen.length} photo${chosen.length > 1 ? "s" : ""}`}
            </button>
          )}
        </form>
      )}
    </section>
  );
}
