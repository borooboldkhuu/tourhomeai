import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { absoluteUrl } from "@/lib/utils";

/**
 * GET /api/qr?slug=<tour-slug>&format=png|svg&size=512
 * Returns a QR code that points at the public tour page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const format = searchParams.get("format") ?? "png";
  const size = Math.min(Number(searchParams.get("size") ?? 512), 2048);

  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

  const target = absoluteUrl(`/tour/${slug}`);
  const options = {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M" as const,
    color: { dark: "#0a0a0aff", light: "#ffffffff" },
  };

  try {
    if (format === "svg") {
      const svg = await QRCode.toString(target, { ...options, type: "svg" });
      return new NextResponse(svg, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
      });
    }

    const buffer = await QRCode.toBuffer(target, { ...options, type: "png" });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="tourhome-${slug}.png"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "QR generation failed" }, { status: 500 });
  }
}
