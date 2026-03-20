import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

/**
 * Square podcast cover art (1400x1400) for Apple Podcasts / Spotify.
 * Apple requires minimum 1400x1400, recommended 3000x3000.
 * @see https://podcasters.apple.com/support/896-artwork-requirements
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "40px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#f8fafc",
          fontFamily: '"Noto Sans JP", sans-serif',
        }}
      >
        {/* Wave bars */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            height: "120px",
          }}
        >
          {[40, 70, 100, 60, 90, 45, 80, 55, 95, 50, 75, 65].map((h, i) => (
            <div
              key={i}
              style={{
                width: "14px",
                height: `${h}%`,
                borderRadius: "7px",
                background: "#f97316",
              }}
            />
          ))}
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <span
            style={{
              fontSize: "120px",
              fontWeight: 800,
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            判断の
          </span>
          <span
            style={{
              fontSize: "120px",
              fontWeight: 800,
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            じかん
          </span>
        </div>

        {/* Subtitle */}
        <span
          style={{
            color: "#f97316",
            fontSize: "36px",
            fontWeight: 800,
            letterSpacing: "0.15em",
            textTransform: "uppercase" as const,
          }}
        >
          AI PODCAST
        </span>

        {/* Tagline */}
        <span
          style={{
            color: "rgba(248,250,252,0.6)",
            fontSize: "28px",
            fontWeight: 600,
            textAlign: "center",
            maxWidth: "1000px",
          }}
        >
          聴くだけで、判断が整理される。
        </span>
      </div>
    ),
    {
      width: 1400,
      height: 1400,
    }
  );
}
