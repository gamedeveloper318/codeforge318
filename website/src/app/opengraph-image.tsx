import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 30% 0%, #12306b 0%, #070a13 55%), #070a13",
        color: "#e6edf7",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 120,
          height: 120,
          borderRadius: 30,
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1020",
          border: "3px solid #3b82f6",
          fontSize: 64,
          color: "#22d3ee",
        }}
      >
        {"</>"}
      </div>
      <div style={{ marginTop: 40, fontSize: 104, fontWeight: 800, letterSpacing: -4 }}>
        {site.name}
      </div>
      <div style={{ marginTop: 12, fontSize: 40, color: "#a5b4cf" }}>{site.tagline}</div>
    </div>,
    size,
  );
}
