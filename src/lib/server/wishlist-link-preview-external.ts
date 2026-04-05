import type { WishLinkPreview } from "@/lib/server/wishlist-link-preview";

const EXTERNAL_RESOLVER_TIMEOUT_MS = 10_000;

type ExternalResolverResponse = {
  imageUrl?: unknown;
  item?: WishLinkPreview | null;
  siteName?: unknown;
  sourceUrl?: unknown;
  targetPrice?: unknown;
  title?: unknown;
};

type ExternalResolutionStrategy = {
  name: string;
  resolve: () => Promise<WishLinkPreview | null>;
};

export async function resolveWishLinkPreviewViaExternalService(input: string) {
  const targetUrl = parseHttpUrl(input);
  const strategies = createExternalResolutionStrategies(targetUrl);
  let lastError: unknown;

  for (const strategy of strategies) {
    try {
      const resolvedItem = await strategy.resolve();

      if (resolvedItem) {
        return resolvedItem;
      }
    } catch (error) {
      lastError = error;
      console.warn("Wishlist link preview external strategy failed.", {
        message: error instanceof Error ? error.message : String(error),
        sourceUrl: input,
        strategy: strategy.name,
      });
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

function createExternalResolutionStrategies(targetUrl: URL): ExternalResolutionStrategy[] {
  const strategies: ExternalResolutionStrategy[] = [];

  if (isTokopediaHostname(targetUrl.hostname)) {
    strategies.push({
      name: "jina-reader",
      resolve: () => resolveWishLinkPreviewViaJinaReader(targetUrl),
    });
  }

  const resolverUrl = process.env.WISHLIST_LINK_RESOLVER_URL?.trim();

  if (resolverUrl) {
    strategies.push({
      name: "configured-resolver",
      resolve: () => resolveWishLinkPreviewViaConfiguredResolver(targetUrl.toString(), resolverUrl),
    });
  }

  return strategies;
}

async function resolveWishLinkPreviewViaJinaReader(targetUrl: URL) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_RESOLVER_TIMEOUT_MS);

  try {
    const readerUrl = `https://r.jina.ai/http://${targetUrl.toString().replace(/^https?:\/\//i, "")}`;
    const response = await fetch(readerUrl, {
      cache: "no-store",
      headers: {
        Accept: "text/plain",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Hosted reader merespons ${response.status}.`);
    }

    const markdown = await response.text();
    return normalizeReaderMarkdown(markdown, targetUrl);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveWishLinkPreviewViaConfiguredResolver(input: string, resolverUrl: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_RESOLVER_TIMEOUT_MS);

  try {
    const response = await fetch(resolverUrl, {
      method: "POST",
      headers: createResolverHeaders(),
      body: JSON.stringify({ url: input }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Resolver eksternal merespons ${response.status}.`);
    }

    const payload = (await response.json()) as ExternalResolverResponse;
    const item = normalizeExternalResolverPayload(payload, input);

    if (!item) {
      throw new Error("Resolver eksternal tidak mengembalikan item yang valid.");
    }

    return item;
  } finally {
    clearTimeout(timeoutId);
  }
}

function createResolverHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const resolverToken = process.env.WISHLIST_LINK_RESOLVER_TOKEN?.trim();

  if (resolverToken) {
    headers.Authorization = `Bearer ${resolverToken}`;
  }

  return headers;
}

function normalizeReaderMarkdown(markdown: string, targetUrl: URL): WishLinkPreview | null {
  if (!markdown.trim()) {
    return null;
  }

  const title = firstNonEmpty(
    normalizeReaderTitle(extractReaderLineValue(markdown, "Title")),
    normalizeReaderTitle(extractFirstMarkdownHeading(markdown)),
  );
  const imageUrl = selectBestReaderImage(markdown, title);
  const targetPrice = extractFirstReaderPrice(markdown);

  if (!title && !imageUrl && targetPrice === undefined) {
    return null;
  }

  return {
    imageUrl,
    siteName: hostnameLabel(targetUrl.hostname),
    sourceUrl: targetUrl.toString(),
    targetPrice,
    title,
  };
}

function normalizeExternalResolverPayload(
  payload: ExternalResolverResponse,
  input: string,
): WishLinkPreview | null {
  const candidate = payload.item ?? payload;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const normalizedItem: WishLinkPreview = {
    imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : undefined,
    siteName: typeof candidate.siteName === "string" ? candidate.siteName : undefined,
    sourceUrl:
      typeof candidate.sourceUrl === "string" && candidate.sourceUrl.trim()
        ? candidate.sourceUrl
        : input,
    targetPrice:
      typeof candidate.targetPrice === "number" && Number.isFinite(candidate.targetPrice)
        ? candidate.targetPrice
        : undefined,
    title: typeof candidate.title === "string" ? candidate.title : undefined,
  };

  if (
    !normalizedItem.title &&
    !normalizedItem.imageUrl &&
    normalizedItem.targetPrice === undefined &&
    !normalizedItem.siteName
  ) {
    return null;
  }

  return normalizedItem;
}

function extractReaderLineValue(markdown: string, label: string) {
  const match = markdown.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || undefined;
}

function extractFirstMarkdownHeading(markdown: string) {
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("#")) {
      continue;
    }

    return trimmed.replace(/^#+\s*/, "").trim();
  }

  return undefined;
}

function normalizeReaderTitle(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/^Jual\s+/i, "")
    .replace(/\s+di\s+[^|]+?\|\s*Tokopedia$/i, "")
    .replace(/\s+\|\s*Tokopedia$/i, "")
    .trim();
}

function selectBestReaderImage(markdown: string, title: string | undefined) {
  const candidates = [...markdown.matchAll(/!\[([^\]]*)\]\((https?:[^)]+)\)/g)].map((match) => ({
    alt: match[1]?.trim() || "",
    url: match[2],
  }));

  let bestUrl: string | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreReaderImageCandidate(candidate.alt, candidate.url, title);

    if (score > bestScore) {
      bestScore = score;
      bestUrl = candidate.url;
    }
  }

  return bestScore > 0 ? bestUrl : undefined;
}

function scoreReaderImageCandidate(alt: string, url: string, title: string | undefined) {
  const normalizedAlt = alt.toLowerCase();
  const normalizedUrl = url.toLowerCase();
  let score = 0;

  if (normalizedUrl.endsWith(".svg")) {
    score -= 8;
  }

  if (/logo|icon|favicon|avatar|badge|sprite/.test(normalizedAlt)) {
    score -= 8;
  }

  if (/logo|icon|favicon|avatar|badge|sprite/.test(normalizedUrl)) {
    score -= 6;
  }

  if (/tokopedia-static|shopeemobile|susercontent/.test(normalizedUrl)) {
    score += 2;
  }

  if (/gambar|image/.test(normalizedAlt)) {
    score += 4;
  }

  if (title) {
    const normalizedTitle = title.toLowerCase();

    if (normalizedAlt.includes(normalizedTitle.slice(0, Math.min(normalizedTitle.length, 24)))) {
      score += 6;
    }
  }

  return score;
}

function extractFirstReaderPrice(markdown: string) {
  const match = markdown.match(/\bRp\s?[\d.]+(?:,\d+)?/i);

  if (!match?.[0]) {
    return undefined;
  }

  return parsePriceValue(match[0]);
}

function parsePriceValue(value: string) {
  const numeric = value.replace(/[^\d.,]/g, "");

  if (!numeric) {
    return undefined;
  }

  const digitsOnly = numeric.replace(/\D/g, "");

  if (!digitsOnly) {
    return undefined;
  }

  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseHttpUrl(input: string) {
  try {
    return new URL(input.trim());
  } catch {
    throw new Error("Link resolver eksternal tidak valid.");
  }
}

function isTokopediaHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  return normalized === "tokopedia.com" || normalized.endsWith(".tokopedia.com");
}

function hostnameLabel(hostname: string) {
  const normalized = hostname.replace(/^www\./i, "");

  if (normalized.includes("tokopedia.com")) {
    return "Tokopedia";
  }

  return normalized;
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}
