import { useState, useEffect, useRef } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  onError?: () => void;
}

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";

const LazyImage = ({ src, alt, className = "", loading = "lazy", onError }: LazyImageProps) => {
  const [isVisible, setIsVisible] = useState(loading === "eager");
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (loading === "eager" || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [loading]);

  if (hasError) return null;

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : PLACEHOLDER}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        setHasError(true);
        onError?.();
      }}
    />
  );
};

export default LazyImage;
