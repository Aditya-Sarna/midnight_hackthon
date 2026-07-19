type GlyphProps = {
  size?: number;
  pulse?: boolean;
  dim?: boolean;
  className?: string;
  alt?: string;
};

/** Identity glyph — cream-native mark, sole payment-surface visual */
export function Glyph({
  size = 96,
  pulse = false,
  dim = false,
  className = "",
  alt = "Circle glyph",
}: GlyphProps) {
  return (
    <img
      src="/glyph.png"
      alt={alt}
      width={size}
      height={size}
      className={`glyph ${pulse ? "glyph--pulse" : ""} ${dim ? "glyph--dim" : ""} ${className}`}
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
}

export function GlyphMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/glyph.png"
      alt=""
      width={size}
      height={size}
      className="glyph-mark"
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
}
