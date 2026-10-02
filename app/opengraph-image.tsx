import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "BizBuddy — run the shop from one book";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#14532d",
          color: "#f6f4f0",
          padding: "72px",
        }}
      >
        <img src={src} width={220} height={220} style={{ borderRadius: 48 }} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 56, maxWidth: 760 }}>
          <div style={{ fontSize: 32, color: "#bbf7d0" }}>BizBuddy</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, marginTop: 16 }}>Run the shop from one book.</div>
          <div style={{ fontSize: 30, lineHeight: 1.35, marginTop: 28, color: "#dcfce7" }}>
            Record what you sold, what came in, and what you spent.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
