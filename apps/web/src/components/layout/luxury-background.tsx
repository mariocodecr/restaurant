import Image from "next/image";

interface LuxuryBackgroundProps {
  /**
   * Public path of a real restaurant photo, e.g. "/restaurant-bg.jpg".
   * Drop the file into apps/web/public/ and pass the path here.
   * If omitted, a CSS-only luxury gradient is used as a graceful fallback.
   */
  imageSrc?: string;
  /** 0 - 1, defaults to 0.6. Higher = more legible content, less photo. */
  overlayOpacity?: number;
}

export function LuxuryBackground({
  imageSrc,
  overlayOpacity = 0.6,
}: LuxuryBackgroundProps) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#070b14]">
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
        // CSS-only fallback: warm restaurant ambience.
        // Layered radial gradients simulate candles + spotlights against deep
        // navy, with a soft brass top accent. Looks intentional, not blank.
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse 60% 40% at 25% 30%, rgba(255, 178, 102, 0.18), transparent 70%)",
              "radial-gradient(ellipse 50% 35% at 80% 70%, rgba(255, 138, 76, 0.12), transparent 75%)",
              "radial-gradient(ellipse 40% 30% at 50% 100%, rgba(129, 216, 255, 0.08), transparent 80%)",
              "linear-gradient(180deg, #0e1626 0%, #070b14 60%, #03060c 100%)",
            ].join(", "),
          }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{
          backgroundColor: `rgba(3, 6, 12, ${overlayOpacity})`,
        }}
      />
      {/* Top + bottom vignette for extra depth */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </div>
  );
}
