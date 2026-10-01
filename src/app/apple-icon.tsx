import { ImageResponse } from "next/og";

/* Icon für „Zum Home-Bildschirm“ auf dem iPhone. Platzhalter bis das echte Logo da ist. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1D4C37" }}>
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: 34,
            background: "#E6B032",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#123526",
            fontSize: 86,
            fontWeight: 800,
          }}
        >
          E
        </div>
      </div>
    ),
    size,
  );
}
