import { useEffect, useState } from "react";

/**
 * Incremental list rendering: show the first `pageSize` items and grow by a
 * page whenever the sentinel element scrolls near the viewport.
 *
 * Render the sentinel only while `hasMore`:
 *   {hasMore && <div ref={sentinelRef} className="h-8" />}
 */
export function useLazyList<T>(items: T[], pageSize = 50) {
  const [count, setCount] = useState(pageSize);
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  // Recreated when count changes so a still-visible sentinel keeps loading
  useEffect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setCount((c) => c + pageSize);
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, pageSize, count]);

  const hasMore = count < items.length;
  return {
    visible: hasMore ? items.slice(0, count) : items,
    hasMore,
    sentinelRef: setSentinel,
  };
}
