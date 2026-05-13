export type PlaceholderImageVariant = "backdrop" | "poster";
const PLACEHOLDER_IMAGE_ROUTE_BASE = "/assets/placeholders";

export type CreatePlaceholderImageUrlInput = {
  variant: PlaceholderImageVariant;
  fileStem: string;
  baseUrl?: string;
  seed?: string;
};

export type BuildPlaceholderImageSvgInput = {
  variant: PlaceholderImageVariant;
  file: string;
  seed?: string;
};

type PlaceholderImageSpec = {
  width: number;
  height: number;
  fontSize: number;
  subtitle: string;
};

const PLACEHOLDER_IMAGE_SPECS: Record<PlaceholderImageVariant, PlaceholderImageSpec> = {
  backdrop: {
    width: 1920,
    height: 1080,
    fontSize: 96,
    subtitle: "MixTV",
  },
  poster: {
    width: 300,
    height: 450,
    fontSize: 38,
    subtitle: "MIXTV",
  },
};

const PLACEHOLDER_IMAGE_COLORS = [
  "1a1a2e",
  "16213e",
  "0f3460",
  "533483",
  "6a2c70",
  "2d4059",
] as const;

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

function hashString(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function pickPlaceholderImageColor(seed: string) {
  const colorIndex = hashString(seed) % PLACEHOLDER_IMAGE_COLORS.length;

  return PLACEHOLDER_IMAGE_COLORS[colorIndex];
}

export function createPlaceholderImageUrl({
  variant,
  fileStem,
  baseUrl = "",
  seed,
}: CreatePlaceholderImageUrlInput) {
  const params = new URLSearchParams();

  if (seed) {
    params.set("seed", seed);
  }

  const search = params.size > 0 ? `?${params.toString()}` : "";

  return `${baseUrl}${PLACEHOLDER_IMAGE_ROUTE_BASE}/${variant}/${encodeURIComponent(fileStem)}.svg${search}`;
}

export function buildPlaceholderImageSvg({
  variant,
  file,
  seed,
}: BuildPlaceholderImageSvgInput) {
  const { width, height, fontSize, subtitle } = PLACEHOLDER_IMAGE_SPECS[variant];
  const title = escapeSvgText(getTitleFromFile(file));
  const color = pickPlaceholderImageColor(seed ?? file);
  const textColor = getReadableTextColor(color);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
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
}
