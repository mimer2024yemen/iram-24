import { ReactNode, useLayoutEffect, useRef, useState } from "react";

interface MarqueeProps {
  children: ReactNode;
  /** true = content travels left→right (used for Arabic), false = right→left */
  reverse?: boolean;
  /** Reading direction of the items inside the track */
  contentDir?: "rtl" | "ltr";
  /** Scroll speed in CSS pixels per second */
  speed?: number;
  rowClassName?: string;
}

/**
 * Seamless, never-empty ticker.
 * The track is always anchored left-to-right (so RTL pages don't push it off-screen),
 * each row repeats the content until it is wider than the visible area, and the
 * duration is computed from the measured width so the speed stays constant.
 */
const Marquee = ({ children, reverse = false, contentDir = "ltr", speed = 55, rowClassName = "" }: MarqueeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  const [reps, setReps] = useState(2);
  const [duration, setDuration] = useState(40);

  useLayoutEffect(() => {
    const measure = () => {
      const unitW = unitRef.current?.scrollWidth || 0;
      const boxW = containerRef.current?.clientWidth || 0;
      if (!unitW || !boxW) return;
      const nextReps = Math.max(1, Math.ceil(boxW / unitW) + 1);
      setReps(nextReps);
      setDuration(Math.max(10, (unitW * nextReps) / speed));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (unitRef.current) ro.observe(unitRef.current);
    return () => ro.disconnect();
  }, [children, speed]);

  const Row = ({ hidden }: { hidden?: boolean }) => (
    <div dir={contentDir} aria-hidden={hidden || undefined} className={`flex shrink-0 items-center whitespace-nowrap ${rowClassName}`}>
      {Array.from({ length: reps }, (_, i) => (
        <div key={i} ref={!hidden && i === 0 ? unitRef : undefined} className="flex shrink-0 items-center">
          {children}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={containerRef} dir="ltr" className="relative flex-1 min-w-0 overflow-hidden">
      <div
        className={`flex w-max marquee-track ${reverse ? "animate-marquee-ltr" : "animate-marquee-rtl"}`}
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        <Row />
        <Row hidden />
      </div>
    </div>
  );
};

export default Marquee;
