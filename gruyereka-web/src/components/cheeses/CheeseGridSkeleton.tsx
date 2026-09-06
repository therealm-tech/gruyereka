/** Skeletons in the shape of the cards they stand in for, so nothing jumps. */
export function CheeseGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((slot) => (
        <div key={slot} className="overflow-hidden rounded-card border border-rule bg-white">
          <div className="h-[140px] bg-paper-2" />
          <div className="flex flex-col gap-2.5 p-3.5">
            <div className="h-5 w-3/4 rounded-[2px] bg-paper-2" />
            <div className="h-3 w-full rounded-[2px] bg-paper-3" />
            <div className="h-3 w-1/2 rounded-[2px] bg-paper-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
