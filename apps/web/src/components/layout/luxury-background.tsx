import Image from "next/image";

interface LuxuryBackgroundProps {
  /**
   * Public path or remote URL of a restaurant photo. If omitted, a CSS-only
   * warm luxury gradient is used as a graceful fallback.
   */
  imageSrc?: string;
  /** 0 - 1, defaults to 0.55. Higher = more legible content, less photo. */
  overlayOpacity?: number;
}

export function LuxuryBackground({
  imageSrc,
  overlayOpacity = 0.55,
}: LuxuryBackgroundProps) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0a0908]">
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        // CSS fallback: warm restaurant ambience — amber spotlights on charcoal
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse 60% 40% at 25% 30%, rgba(212, 163, 92, 0.22), transparent 70%)",
              "radial-gradient(ellipse 50% 35% at 80% 70%, rgba(181, 133, 67, 0.16), transparent 75%)",
              "radial-gradient(ellipse 40% 30% at 50% 100%, rgba(255, 196, 110, 0.1), transparent 80%)",
              "linear-gradient(180deg, #1a1611 0%, #0d0b08 60%, #050403 100%)",
            ].join(", "),
          }}
        />
      )}
      {/* Warm-tinted dark overlay so glass cards stay readable */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            rgba(10, 9, 8, ${Math.max(0, overlayOpacity - 0.1)}) 0%,
            rgba(10, 9, 8, ${overlayOpacity}) 50%,
            rgba(10, 9, 8, ${Math.min(1, overlayOpacity + 0.15)}) 100%)`,
        }}
      />
      {/* Soft vignette */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}
