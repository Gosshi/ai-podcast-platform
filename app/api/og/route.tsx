import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { BRAND_NAME, PRODUCT_NAME, SITE_NAME } from "@/src/lib/brand";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") ?? SITE_NAME;
  const genre = searchParams.get("genre");
  const date = searchParams.get("date");
  const cards = searchParams.get("cards");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#f8fafc",
          fontFamily: '"Noto Sans JP", sans-serif',
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {genre && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  background: "#f97316",
                  color: "#fff",
                  padding: "6px 16px",
                  borderRadius: "999px",
                  fontSize: "20px",
                  fontWeight: 700,
                }}
              >
                {genre}
              </span>
              {date && (
                <span
                  style={{
                    color: "rgba(248,250,252,0.6)",
                    fontSize: "20px",
                  }}
                >
                  {date}
                </span>
              )}
            </div>
          )}
          <h1
            style={{
              fontSize: title.length > 30 ? "48px" : "56px",
              fontWeight: 800,
              lineHeight: 1.2,
              margin: 0,
              maxWidth: "900px",
            }}
          >
            {title}
          </h1>
          {cards && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "rgba(248,250,252,0.7)",
                fontSize: "22px",
              }}
            >
              <span>トピックカード {cards}件</span>
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                color: "#f97316",
                fontSize: "16px",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
              }}
            >
              {BRAND_NAME}
            </span>
            <span style={{ fontSize: "28px", fontWeight: 700 }}>
              {PRODUCT_NAME}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "3px",
              alignItems: "flex-end",
              height: "40px",
            }}
          >
            {[30, 60, 85, 50, 100, 40, 75, 55, 90, 45].map((h, i) => (
              <div
                key={i}
                style={{
                  width: "6px",
                  height: `${h}%`,
                  borderRadius: "3px",
                  background: "#f97316",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
