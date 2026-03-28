import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AIValid - Platform Validasi AI #1 di Indonesia";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        padding: "60px",
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
        }}
      >
        {/* AV Glyph icon */}
        <svg viewBox="0 0 512 512" width="72" height="72" style={{ marginRight: "20px" }}>
          <path
            d="M 239.7 68.1 Q 256.0 36.0 272.3 68.1 L 463.7 443.9 Q 480.0 476.0 444.0 476.0 L 68.0 476.0 Q 32.0 476.0 48.3 443.9 Z M 246.9 238.2 Q 256.0 216.0 265.1 238.2 L 338.9 417.8 Q 348.0 440.0 324.0 440.0 L 188.0 440.0 Q 164.0 440.0 173.1 417.8 Z"
            fill="#4f46e5"
            fillRule="evenodd"
          />
        </svg>
        <span
          style={{
            fontSize: "64px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-1px",
          }}
        >
          AIValid
        </span>
      </div>

      {/* Tagline */}
      <p
        style={{
          fontSize: "32px",
          color: "#a1a1aa",
          textAlign: "center",
          marginTop: "0px",
          marginBottom: "40px",
        }}
      >
        Platform Validasi AI #1 di Indonesia
      </p>

      {/* Accent line */}
      <div
        style={{
          display: "flex",
          width: "120px",
          height: "4px",
          borderRadius: "2px",
          background: "linear-gradient(90deg, #4f46e5, #818cf8)",
        }}
      />
    </div>,
    { ...size }
  );
}
