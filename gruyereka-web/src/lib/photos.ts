/** Where the browser asks for a visit's photo: this origin's relay, never the API. */
export function photoPath(tastingId: string, photoId: string): string {
  return `/photos/${tastingId}/${photoId}`;
}
