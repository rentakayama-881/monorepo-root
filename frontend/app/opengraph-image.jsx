import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AIValid - Platform Validasi AI #1 di Indonesia";
export const size = { width: 1200, height: 630 };
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "72px",
            height: "72px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            marginRight: "20px",
          }}
        >
          <span
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            AI
          </span>
        </div>
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
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
        }}
      />
    </div>,
    { ...size }
  );
}
