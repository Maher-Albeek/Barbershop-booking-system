import type { ImgHTMLAttributes } from "react";

type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes"> & {
  src: string;
  alt: string;
  sizes: string;
  widths?: number[];
  pictureClassName?: string;
};

const defaultWidths = [360, 560, 760, 1000, 1400, 1800];

function withImageWidth(src: string, width: number, format?: "avif" | "webp") {
  try {
    const url = new URL(src, window.location.origin);

    if (url.hostname.includes("images.unsplash.com")) {
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("w", String(width));
      url.searchParams.set("q", format === "avif" ? "62" : "76");
      if (format) url.searchParams.set("fm", format);
      return url.toString();
    }

    return src;
  } catch {
    return src;
  }
}

function buildSrcSet(src: string, widths: number[], format?: "avif" | "webp") {
  const candidates = widths.map((width) => `${withImageWidth(src, width, format)} ${width}w`);
  return Array.from(new Set(candidates)).join(", ");
}

function canBuildResponsiveSources(src: string) {
  try {
    return new URL(src, window.location.origin).hostname.includes("images.unsplash.com");
  } catch {
    return false;
  }
}

export function ResponsiveImage({
  src,
  alt,
  sizes,
  widths = defaultWidths,
  pictureClassName,
  loading = "lazy",
  decoding = "async",
  ...imageProps
}: ResponsiveImageProps) {
  const responsive = canBuildResponsiveSources(src);
  const fallbackSrc = responsive ? withImageWidth(src, widths[Math.min(2, widths.length - 1)]) : src;

  return (
    <picture className={pictureClassName}>
      {responsive ? <source type="image/avif" srcSet={buildSrcSet(src, widths, "avif")} sizes={sizes} /> : null}
      {responsive ? <source type="image/webp" srcSet={buildSrcSet(src, widths, "webp")} sizes={sizes} /> : null}
      <img
        {...imageProps}
        src={fallbackSrc}
        srcSet={responsive ? buildSrcSet(src, widths) : undefined}
        sizes={responsive ? sizes : undefined}
        alt={alt}
        loading={loading}
        decoding={decoding}
      />
    </picture>
  );
}
