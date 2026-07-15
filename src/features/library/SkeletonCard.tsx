/** Shimmer placeholder matching DeviceCard's layout, shown while the
 *  library "loads" — establishes the loading design language early. */
export function SkeletonCard() {
  return (
    <div className="w-full rounded-[10px] p-2" aria-hidden>
      <div className="flex items-start gap-2.5">
        <div className="skeleton h-11 w-[76px] shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-2.5 w-1/2 rounded" />
          <div className="flex gap-1 pt-0.5">
            <div className="skeleton h-[17px] w-8 rounded-[5px]" />
            <div className="skeleton h-[17px] w-14 rounded-[5px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
