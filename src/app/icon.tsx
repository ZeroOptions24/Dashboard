import { ImageResponse } from "next/og";

/* App-Icon (Browser-Tab, Startbildschirm). Platzhalter bis das echte Logo da ist: das „E“ aus der Seitenleiste. */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1D4C37" }}>
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 96,
            background: "#E6B032",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#123526",
            fontSize: 240,
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
