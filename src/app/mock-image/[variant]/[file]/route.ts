type MockImageRouteContext = {
  params: Promise<{
    variant: string;
    file: string;
  }>;
};

const DEFAULT_COLOR = "1a1a2e";
const COLOR_PATTERN = /^[0-9a-f]{6}$/i;

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getReadableTextColor(hexColor: string) {
  const red = parseInt(hexColor.slice(0, 2), 16);
  const green = parseInt(hexColor.slice(2, 4), 16);
  const blue = parseInt(hexColor.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.58 ? "111827" : "ffffff";
}

function getTitleFromFile(file: string) {
  return decodeURIComponent(file).replace(/\.svg$/i, "");
}

export async function GET(request: Request, { params }: MockImageRouteContext) {
  const { variant, file } = await params;
  const { searchParams } = new URL(request.url);
  const requestedColor = searchParams.get("color") ?? DEFAULT_COLOR;
  const color = COLOR_PATTERN.test(requestedColor) ? requestedColor : DEFAULT_COLOR;
  const width = variant === "backdrop" ? 1920 : 300;
  const height = variant === "backdrop" ? 1080 : 450;
  const title = escapeSvgText(getTitleFromFile(file));
  const textColor = getReadableTextColor(color);
  const fontSize = variant === "backdrop" ? 96 : 38;
  const subtitle = variant === "backdrop" ? "MixTV" : "MIXTV";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#${color}"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="${width * 0.08}" y="${height * 0.1}" width="${width * 0.84}" height="${height * 0.8}" rx="28" fill="#ffffff" opacity="0.08"/>
  <text x="50%" y="46%" text-anchor="middle" fill="#${textColor}" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="${fontSize}" font-weight="700">${title}</text>
  <text x="50%" y="58%" text-anchor="middle" fill="#${textColor}" opacity="0.64" font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 0.34)}" font-weight="700" letter-spacing="4">${subtitle}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
