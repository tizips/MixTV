import { buildPlaceholderImageSvg } from "@/shared/media/placeholder-image";

type PlaceholderImageRouteContext = {
  params: Promise<{
    variant: string;
    file: string;
  }>;
};

export async function GET(request: Request, { params }: PlaceholderImageRouteContext) {
  const { variant, file } = await params;
  const { searchParams } = new URL(request.url);
  const normalizedVariant = variant === "backdrop" ? "backdrop" : "poster";
  const svg = buildPlaceholderImageSvg({
    variant: normalizedVariant,
    file,
    seed: searchParams.get("seed") ?? undefined,
  });

  return new Response(svg, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
