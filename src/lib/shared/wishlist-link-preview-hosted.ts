export type HostedWishLinkPreview = {
  imageUrl?: string;
  siteName?: string;
  sourceUrl: string;
  targetPrice?: number;
  title?: string;
};

export type HostedWishLinkPreviewDiagnostic = {
  contentType?: string;
  detail?: string;
  elapsedMs: number;
  fetchProfile?: string;
  reason: "content-type" | "http" | "network" | "timeout";
  status?: number;
  url: string;
};

type WishLinkFetchProfile = {
  headers: Record<string, string>;
  name: string;
};

type HostedWishLinkPreviewResult = {
  diagnostics: HostedWishLinkPreviewDiagnostic[];
  item: HostedWishLinkPreview;
};

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 3_500;
const TRACKING_QUERY_PARAM_PATTERNS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^srsltid$/i,
  /^ref$/i,
  /^spm$/i,
  /^t_/i,
];
const BROWSER_LIKE_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
};

class HostedWishLinkPreviewRecoverableError extends Error {
  diagnostics: HostedWishLinkPreviewDiagnostic[];

  constructor(message: string, diagnostics: HostedWishLinkPreviewDiagnostic[]) {
    super(message);
    this.name = "HostedWishLinkPreviewRecoverableError";
    this.diagnostics = diagnostics;
  }
}

export async function resolveHostedWishLinkPreview(input: string): Promise<HostedWishLinkPreviewResult> {
  const initialUrl = parsePublicHttpUrl(input);
  const document = await fetchLinkDocument(initialUrl);
  const item = extractHostedWishLinkPreview(document.finalUrl, document.body, document.contentType);

  if (!item.title && !item.imageUrl && item.targetPrice === undefined) {
    throw new HostedWishLinkPreviewRecoverableError("Link ini belum bisa dibaca sebagai halaman produk.", [
      {
        contentType: document.contentType,
        detail: summarizeDocumentShape(document.body),
        elapsedMs: 0,
        reason: "content-type",
        status: document.status,
        url: document.finalUrl.toString(),
      },
    ]);
  }

  return {
    diagnostics: document.diagnostics,
    item,
  };
}

export function isHostedWishLinkPreviewRecoverableError(error: unknown) {
  return error instanceof HostedWishLinkPreviewRecoverableError;
}

export function getHostedWishLinkPreviewDiagnostics(error: unknown) {
  return error instanceof HostedWishLinkPreviewRecoverableError ? error.diagnostics : [];
}

export function isShopeeHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "shopee.co.id" || normalized.endsWith(".shopee.co.id");
}

export function isTokopediaHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "tokopedia.com" || normalized.endsWith(".tokopedia.com");
}

async function fetchLinkDocument(initialUrl: URL) {
  const candidateUrls = createFetchUrlCandidates(initialUrl);
  const diagnostics: HostedWishLinkPreviewDiagnostic[] = [];

  for (const candidateUrl of candidateUrls) {
    try {
      return await fetchLinkDocumentWithProfiles(candidateUrl, diagnostics);
    } catch (error) {
      if (!(error instanceof HostedWishLinkPreviewRecoverableError)) {
        throw error;
      }

      diagnostics.push(...error.diagnostics);
    }
  }

  throw new HostedWishLinkPreviewRecoverableError("Link tidak bisa diambil sekarang.", diagnostics);
}

async function fetchLinkDocumentWithProfiles(initialUrl: URL, accumulatedDiagnostics: HostedWishLinkPreviewDiagnostic[]) {
  const diagnostics = [...accumulatedDiagnostics];

  for (const profile of getFetchProfilesForHostname(initialUrl.hostname)) {
    try {
      const result = await fetchLinkDocumentWithProfile(initialUrl, profile);
      return {
        ...result,
        diagnostics,
      };
    } catch (error) {
      if (!(error instanceof HostedWishLinkPreviewRecoverableError)) {
        throw error;
      }

      diagnostics.push(...error.diagnostics);
    }
  }

  throw new HostedWishLinkPreviewRecoverableError("Link tidak bisa diambil sekarang.", diagnostics);
}

async function fetchLinkDocumentWithProfile(initialUrl: URL, profile: WishLinkFetchProfile) {
  let currentUrl = initialUrl;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    assertPublicHostname(currentUrl.hostname);

    const controller = new AbortController();
    const startedAt = Date.now();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        cache: "no-store",
        headers: profile.headers,
        redirect: "manual",
        signal: controller.signal,
      });

      const isRedirect =
        response.status >= 300 &&
        response.status < 400 &&
        Boolean(response.headers.get("location"));

      if (isRedirect) {
        const nextUrl = new URL(response.headers.get("location") ?? "", currentUrl);
        currentUrl = parsePublicHttpUrl(nextUrl.toString());
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();
      const finalUrl = response.url ? parsePublicHttpUrl(response.url) : currentUrl;

      if (shouldRetryWithAlternateFetchProfile(currentUrl.hostname, body)) {
        throw new HostedWishLinkPreviewRecoverableError(
          "Link perlu dicoba ulang dengan profil fetch lain.",
          [
            {
              contentType,
              detail: "blocked-document",
              elapsedMs: Date.now() - startedAt,
              fetchProfile: profile.name,
              reason: "content-type",
              status: response.status,
              url: currentUrl.toString(),
            },
          ],
        );
      }

      if (canParseLinkDocument(response.status, contentType, body)) {
        return {
          body,
          contentType,
          finalUrl,
          status: response.status,
        };
      }

      throw new HostedWishLinkPreviewRecoverableError(
        response.ok ? "Link ini belum bisa dibaca sebagai halaman produk." : "Link tidak bisa diambil sekarang.",
        [
          {
            contentType,
            detail: summarizeDocumentShape(body),
            elapsedMs: Date.now() - startedAt,
            fetchProfile: profile.name,
            reason: response.ok ? "content-type" : "http",
            status: response.status,
            url: currentUrl.toString(),
          },
        ],
      );
    } catch (error) {
      if (error instanceof HostedWishLinkPreviewRecoverableError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new HostedWishLinkPreviewRecoverableError(
          "Link sedang lambat dibaca. Coba tempel ulang atau isi manual dulu.",
          [
            {
              elapsedMs: Date.now() - startedAt,
              fetchProfile: profile.name,
              reason: "timeout",
              url: currentUrl.toString(),
            },
          ],
        );
      }

      throw new HostedWishLinkPreviewRecoverableError("Link tidak bisa diambil sekarang.", [
        {
          detail: error instanceof Error ? error.message : String(error),
          elapsedMs: Date.now() - startedAt,
          fetchProfile: profile.name,
          reason: "network",
          url: currentUrl.toString(),
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Redirect link terlalu banyak.");
}

function extractHostedWishLinkPreview(finalUrl: URL, content: string, contentType: string): HostedWishLinkPreview {
  if (contentType.includes("application/json") || looksLikeStructuredDataPayload(content)) {
    const payload = safeJsonParse(content.trim());
    const jsonItem = extractStandaloneStructuredProductData(content, { finalUrl, titleHints: [] });

    if (jsonItem) {
      return {
        imageUrl: normalizeImageUrl(jsonItem.imageUrl, finalUrl),
        siteName: hostnameLabel(finalUrl.hostname),
        sourceUrl: finalUrl.toString(),
        targetPrice: jsonItem.targetPrice,
        title: jsonItem.title,
      };
    }

    const product = findProductData(payload);

    if (product) {
      return {
        imageUrl: normalizeImageUrl(extractImageValue(product.image), finalUrl),
        siteName: hostnameLabel(finalUrl.hostname),
        sourceUrl: finalUrl.toString(),
        targetPrice: extractOfferPrice(product.offers),
        title: typeof product.name === "string" ? cleanText(product.name) : undefined,
      };
    }
  }

  const metaTags = collectMetaTags(content);
  const documentTitle = extractDocumentTitle(content);
  const ldJsonProduct = extractLdJsonProduct(content);
  const titleHints = [
    metaTags.get("og:title"),
    metaTags.get("twitter:title"),
    documentTitle,
  ].flatMap((value) => (value ? [value] : []));
  const standaloneStructuredProduct = extractStandaloneStructuredProductData(content, {
    finalUrl,
    titleHints,
  });
  const inlinePatternProduct = extractHtmlPatternData(content);

  return {
    imageUrl: normalizeImageUrl(
      firstNonEmpty(
        metaTags.get("og:image:secure_url"),
        metaTags.get("og:image:url"),
        metaTags.get("og:image"),
        metaTags.get("twitter:image:src"),
        metaTags.get("twitter:image"),
        ldJsonProduct?.imageUrl,
        standaloneStructuredProduct?.imageUrl,
        inlinePatternProduct.imageUrl,
      ),
      finalUrl,
    ),
    siteName: firstNonEmpty(
      metaTags.get("og:site_name"),
      metaTags.get("twitter:site"),
      hostnameLabel(finalUrl.hostname),
    ),
    sourceUrl: finalUrl.toString(),
    targetPrice: firstDefinedNumber(
      parsePriceValue(
        firstNonEmpty(
          metaTags.get("product:price:amount"),
          metaTags.get("product:price:standard_amount"),
          metaTags.get("og:price:amount"),
          metaTags.get("price"),
        ),
      ),
      ldJsonProduct?.targetPrice,
      standaloneStructuredProduct?.targetPrice,
      inlinePatternProduct.targetPrice,
    ),
    title: firstNonEmpty(
      metaTags.get("og:title"),
      metaTags.get("twitter:title"),
      ldJsonProduct?.title,
      standaloneStructuredProduct?.title,
      documentTitle,
    ),
  };
}

function getFetchProfilesForHostname(hostname: string): WishLinkFetchProfile[] {
  if (isShopeeHostname(hostname)) {
    return [
      {
        headers: {
          ...BROWSER_LIKE_HEADERS,
          "User-Agent": "Twitterbot/1.0",
        },
        name: "twitterbot",
      },
      {
        headers: {
          ...BROWSER_LIKE_HEADERS,
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        },
        name: "facebookexternalhit",
      },
      {
        headers: BROWSER_LIKE_HEADERS,
        name: "browser",
      },
    ];
  }

  return [
    {
      headers: BROWSER_LIKE_HEADERS,
      name: "browser",
    },
  ];
}

function parsePublicHttpUrl(input: string) {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Link tidak valid.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Gunakan link http atau https.");
  }

  if (!url.hostname) {
    throw new Error("Host link tidak valid.");
  }

  return url;
}

function assertPublicHostname(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname.endsWith(".local") ||
    normalizedHostname.endsWith(".internal")
  ) {
    throw new Error("Link lokal atau internal tidak didukung.");
  }

  if (isPrivateAddress(normalizedHostname)) {
    throw new Error("Link privat tidak didukung.");
  }
}

function isPrivateAddress(address: string) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) {
    return false;
  }

  const parts = address.split(".").map((part) => Number(part));
  const [first = 0, second = 0] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function collectMetaTags(html: string) {
  const metaTags = new Map<string, string>();
  const matches = html.match(/<meta\s+[^>]*>/gi) ?? [];

  for (const tag of matches) {
    const key = firstNonEmpty(
      getTagAttribute(tag, "property"),
      getTagAttribute(tag, "name"),
      getTagAttribute(tag, "itemprop"),
    );
    const content = getTagAttribute(tag, "content");

    if (!key || !content) {
      continue;
    }

    metaTags.set(key.trim().toLowerCase(), cleanText(content));
  }

  return metaTags;
}

function getTagAttribute(tag: string, attribute: string) {
  const quotedMatch = tag.match(new RegExp(`${attribute}\\s*=\\s*(['"])(.*?)\\1`, "i"));

  if (quotedMatch?.[2]) {
    return decodeHtmlEntities(quotedMatch[2]);
  }

  const unquotedMatch = tag.match(new RegExp(`${attribute}\\s*=\\s*([^\\s>]+)`, "i"));
  return unquotedMatch?.[1] ? decodeHtmlEntities(unquotedMatch[1]) : undefined;
}

function extractDocumentTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? cleanText(match[1]) : undefined;
}

function extractLdJsonProduct(html: string) {
  const scripts =
    html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

  for (const script of scripts) {
    const contentMatch = script.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
    );

    if (!contentMatch?.[1]) {
      continue;
    }

    const parsed = safeJsonParse(decodeHtmlEntities(contentMatch[1].trim()));
    const product = findProductData(parsed);

    if (!product) {
      continue;
    }

    return {
      imageUrl: extractImageValue(product.image),
      targetPrice: extractOfferPrice(product.offers),
      title: typeof product.name === "string" ? cleanText(product.name) : undefined,
    };
  }

  return undefined;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function findProductData(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const product = findProductData(item);

      if (product) {
        return product;
      }
    }

    return null;
  }

  const candidate = value as Record<string, unknown>;
  const candidateType = candidate["@type"];

  if (
    candidateType === "Product" ||
    (Array.isArray(candidateType) && candidateType.includes("Product"))
  ) {
    return candidate;
  }

  for (const nestedValue of Object.values(candidate)) {
    const product = findProductData(nestedValue);

    if (product) {
      return product;
    }
  }

  return null;
}

function extractImageValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const image = extractImageValue(item);

      if (image) {
        return image;
      }
    }

    return undefined;
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;

    return firstNonEmpty(
      typeof candidate.url === "string" ? cleanText(candidate.url) : undefined,
      typeof candidate.contentUrl === "string" ? cleanText(candidate.contentUrl) : undefined,
      typeof candidate.image_url === "string" ? cleanText(candidate.image_url) : undefined,
      typeof candidate.primary_image === "string" ? cleanText(candidate.primary_image) : undefined,
      typeof candidate.thumbnail_url === "string" ? cleanText(candidate.thumbnail_url) : undefined,
      typeof candidate["@id"] === "string" ? cleanText(candidate["@id"]) : undefined,
    );
  }

  return undefined;
}

function extractOfferPrice(value: unknown): number | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const price = extractOfferPrice(item);

      if (price) {
        return price;
      }
    }

    return undefined;
  }

  if (typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return firstDefinedNumber(
      parsePriceValue(candidate.price),
      parsePriceValue(candidate.current_retail),
      parsePriceValue(candidate.currentRetail),
      parsePriceValue(candidate.reg_retail),
      parsePriceValue(candidate.regRetail),
      parsePriceValue(candidate.sale_price),
      parsePriceValue(candidate.salePrice),
      parsePriceValue(candidate.formatted_current_price),
      parsePriceValue(candidate.formattedCurrentPrice),
      parsePriceValue(candidate.lowPrice),
      parsePriceValue(candidate.highPrice),
      extractOfferPrice(candidate.priceSpecification),
      extractOfferPrice(candidate.offers),
    );
  }

  return parsePriceValue(value);
}

function extractStandaloneStructuredProductData(
  content: string,
  signals: { finalUrl: URL; titleHints: string[] },
) {
  const payloads = extractStructuredDataPayloads(content);
  const candidates = payloads.flatMap((payload) => collectProductLikeData(payload));
  const product = selectPreferredProductLikeData(candidates, signals);

  if (!product) {
    return undefined;
  }

  return {
    imageUrl: extractCandidateImage(product),
    targetPrice: extractCandidatePrice(product),
    title: extractCandidateTitle(product),
  };
}

function extractStructuredDataPayloads(content: string) {
  const payloads: unknown[] = [];
  const trimmed = content.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = safeJsonParse(trimmed);

    if (parsed) {
      payloads.push(parsed);
    }
  }

  const jsonParseMatches = content.matchAll(/JSON\.parse\(("(?:\\.|[^"\\])*")\)/g);

  for (const match of jsonParseMatches) {
    const decoded = safeJsonParse(match[1]);

    if (typeof decoded !== "string") {
      continue;
    }

    const parsed = safeJsonParse(decoded);

    if (parsed) {
      payloads.push(parsed);
    }
  }

  return payloads;
}

function collectProductLikeData(value: unknown, seen = new Set<object>()): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectProductLikeData(item, seen));
  }

  const candidate = value as Record<string, unknown>;
  const candidateType = candidate["@type"];
  const items: Array<Record<string, unknown>> = [];
  const hasTitle = Boolean(extractCandidateTitle(candidate));
  const hasImage = Boolean(extractCandidateImage(candidate));
  const hasPrice = Boolean(extractCandidatePrice(candidate));
  const hasSourceUrl = Boolean(extractCandidateSourceUrl(candidate));

  if (
    candidateType === "Product" ||
    (Array.isArray(candidateType) && candidateType.includes("Product")) ||
    (hasTitle && (hasImage || hasPrice || hasSourceUrl))
  ) {
    items.push(candidate);
  }

  for (const nestedValue of Object.values(candidate)) {
    items.push(...collectProductLikeData(nestedValue, seen));
  }

  return items;
}

function selectPreferredProductLikeData(
  candidates: Array<Record<string, unknown>>,
  signals: { finalUrl: URL; titleHints: string[] },
) {
  let bestCandidate: Record<string, unknown> | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreProductLikeData(candidate, signals);

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function scoreProductLikeData(
  candidate: Record<string, unknown>,
  signals: { finalUrl: URL; titleHints: string[] },
) {
  let score = 0;
  const title = extractCandidateTitle(candidate);
  const sourceUrl = extractCandidateSourceUrl(candidate);
  const hasImage = Boolean(extractCandidateImage(candidate));
  const hasPrice = Boolean(extractCandidatePrice(candidate));

  if (title) {
    score += 2;
  }

  if (hasImage) {
    score += 2;
  }

  if (hasPrice) {
    score += 3;
  }

  if (sourceUrl && urlsLookEquivalent(sourceUrl, signals.finalUrl)) {
    score += 6;
  }

  const normalizedTitle = title ? normalizeComparableText(title) : "";

  for (const hint of signals.titleHints) {
    const normalizedHint = normalizeComparableText(hint);

    if (!normalizedTitle || !normalizedHint) {
      continue;
    }

    if (normalizedTitle === normalizedHint) {
      score += 8;
      continue;
    }

    if (normalizedTitle.includes(normalizedHint) || normalizedHint.includes(normalizedTitle)) {
      score += 4;
    }
  }

  return score;
}

function extractCandidateTitle(candidate: Record<string, unknown>) {
  const productDescription = asRecord(candidate.product_description);
  const nestedProductDescription = asRecord(candidate.productDescription);

  return firstNonEmpty(
    typeof candidate.name === "string" ? cleanText(candidate.name) : undefined,
    typeof candidate.title === "string" ? cleanText(candidate.title) : undefined,
    typeof productDescription?.title === "string" ? cleanText(productDescription.title) : undefined,
    typeof nestedProductDescription?.title === "string"
      ? cleanText(nestedProductDescription.title)
      : undefined,
  );
}

function extractCandidateImage(candidate: Record<string, unknown>) {
  const imageInfo = asRecord(candidate.image_info);
  const nestedImageInfo = asRecord(candidate.imageInfo);

  return firstNonEmpty(
    extractImageValue(candidate.image),
    extractImageValue(candidate.imageUrl),
    extractImageValue(candidate.primaryImage),
    extractImageValue(candidate.primary_image),
    extractImageValue(candidate.image_url),
    extractImageValue(candidate.thumbnailUrl),
    extractImageValue(candidate.thumbnail_url),
    extractImageValue(imageInfo),
    extractImageValue(imageInfo?.primary_image),
    typeof imageInfo?.primary_image_url === "string"
      ? cleanText(imageInfo.primary_image_url)
      : undefined,
    extractImageValue(nestedImageInfo),
    extractImageValue(nestedImageInfo?.primaryImage),
    typeof nestedImageInfo?.primaryImageUrl === "string"
      ? cleanText(nestedImageInfo.primaryImageUrl)
      : undefined,
  );
}

function extractCandidatePrice(candidate: Record<string, unknown>) {
  return firstDefinedNumber(
    extractOfferPrice(candidate.offers),
    parsePriceValue(candidate.price),
    extractOfferPrice(candidate.price),
    extractOfferPrice(candidate.priceInfo),
    extractOfferPrice(candidate.pricing),
    parsePriceValue(candidate.current_retail),
    parsePriceValue(candidate.currentRetail),
    parsePriceValue(candidate.formatted_current_price),
    parsePriceValue(candidate.formattedCurrentPrice),
  );
}

function extractCandidateSourceUrl(candidate: Record<string, unknown>) {
  return firstNonEmpty(
    typeof candidate.buy_url === "string" ? cleanText(candidate.buy_url) : undefined,
    typeof candidate.buyUrl === "string" ? cleanText(candidate.buyUrl) : undefined,
    typeof candidate.source_url === "string" ? cleanText(candidate.source_url) : undefined,
    typeof candidate.sourceUrl === "string" ? cleanText(candidate.sourceUrl) : undefined,
    typeof candidate.url === "string" ? cleanText(candidate.url) : undefined,
  );
}

function urlsLookEquivalent(candidateUrl: string, finalUrl: URL) {
  try {
    const parsed = new URL(candidateUrl, finalUrl);

    return (
      parsed.hostname.replace(/^www\./i, "") === finalUrl.hostname.replace(/^www\./i, "") &&
      parsed.pathname === finalUrl.pathname
    );
  } catch {
    return false;
  }
}

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function extractHtmlPatternData(html: string) {
  return {
    imageUrl: extractHtmlPatternImage(html),
    targetPrice: extractHtmlPatternPrice(html),
  };
}

function extractHtmlPatternImage(html: string) {
  const value = firstNonEmpty(
    extractHtmlPatternString(
      html,
      /(?:\\?")primary_image_url(?:\\?")\s*:\s*(?:\\?")((?:https?:)?(?:\\\/|\/){2}[^"]+?)(?:\\?")/i,
    ),
    extractHtmlPatternString(
      html,
      /(?:\\?")image_url(?:\\?")\s*:\s*(?:\\?")((?:https?:)?(?:\\\/|\/){2}[^"]+?)(?:\\?")/i,
    ),
  );

  if (!value) {
    return undefined;
  }

  return value.replace(/\\\//g, "/");
}

function extractHtmlPatternPrice(html: string) {
  return firstDefinedNumber(
    extractHtmlPatternNumber(
      html,
      /(?:\\?")current_retail(?:\\?")\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    ),
    extractHtmlPatternNumber(
      html,
      /(?:\\?")reg_retail(?:\\?")\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    ),
    parsePriceValue(
      extractHtmlPatternString(
        html,
        /(?:\\?")formatted_current_price(?:\\?")\s*:\s*(?:\\?")([^"]+)(?:\\?")/i,
      ),
    ),
  );
}

function extractHtmlPatternString(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1] ? cleanText(match[1]) : undefined;
}

function extractHtmlPatternNumber(html: string, pattern: RegExp) {
  const value = extractHtmlPatternString(html, pattern);
  return value ? parsePriceValue(value) : undefined;
}

function parsePriceValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim();

  if (!cleaned) {
    return undefined;
  }

  const numeric = cleaned.replace(/[^\d.,]/g, "");

  if (!numeric) {
    return undefined;
  }

  const commaIndex = numeric.lastIndexOf(",");
  const dotIndex = numeric.lastIndexOf(".");
  const hasComma = commaIndex >= 0;
  const hasDot = dotIndex >= 0;

  if (hasComma || hasDot) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const separatorIndex = numeric.lastIndexOf(decimalSeparator);
    const fraction = numeric.slice(separatorIndex + 1);

    if (fraction.length > 0 && fraction.length <= 2) {
      const integerPart = numeric.slice(0, separatorIndex).replace(/[^\d]/g, "");
      const normalized = `${integerPart}.${fraction}`;
      const parsedFloat = Number.parseFloat(normalized);

      if (Number.isFinite(parsedFloat)) {
        return Math.round(parsedFloat);
      }
    }
  }

  const digitsOnly = numeric.replace(/\D/g, "");

  if (!digitsOnly) {
    return undefined;
  }

  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeImageUrl(value: string | undefined, baseUrl: URL) {
  if (!value) {
    return undefined;
  }

  try {
    const imageUrl = new URL(value, baseUrl);

    if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
      return undefined;
    }

    return imageUrl.toString();
  } catch {
    return undefined;
  }
}

function createFetchUrlCandidates(initialUrl: URL) {
  const normalizedUrls = new Map<string, URL>();
  normalizedUrls.set(initialUrl.toString(), initialUrl);

  const strippedUrl = stripTrackingSearchParams(initialUrl);
  normalizedUrls.set(strippedUrl.toString(), strippedUrl);

  return [...normalizedUrls.values()];
}

function stripTrackingSearchParams(url: URL) {
  const nextUrl = new URL(url.toString());
  const keys = [...nextUrl.searchParams.keys()];

  for (const key of keys) {
    if (TRACKING_QUERY_PARAM_PATTERNS.some((pattern) => pattern.test(key))) {
      nextUrl.searchParams.delete(key);
    }
  }

  return nextUrl;
}

function shouldRetryWithAlternateFetchProfile(hostname: string, html: string) {
  if (!isShopeeHostname(hostname)) {
    return false;
  }

  if (hasUsefulProductSignals(html)) {
    return false;
  }

  return /halaman tidak tersedia|log in dan coba lagi|captcha/i.test(html);
}

function canParseLinkDocument(status: number, contentType: string, body: string) {
  const htmlLike =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml") ||
    looksLikeHtmlDocument(body);
  const structuredLike =
    contentType.includes("application/json") || looksLikeStructuredDataPayload(body);

  if (status >= 200 && status < 300) {
    return htmlLike || structuredLike;
  }

  return hasUsefulProductSignals(body) && (htmlLike || structuredLike);
}

function looksLikeHtmlDocument(value: string) {
  const trimmed = value.trimStart();

  return (
    trimmed.startsWith("<!DOCTYPE html") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<head") ||
    trimmed.startsWith("<body")
  );
}

function looksLikeStructuredDataPayload(value: string) {
  const trimmed = value.trim();

  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function hasUsefulProductSignals(value: string) {
  return /og:title|og:image|application\/ld\+json|product:price:amount|current_retail|formatted_current_price|__NEXT_DATA__|JSON\.parse\(/i.test(
    value,
  );
}

function summarizeDocumentShape(value: string) {
  if (!value.trim()) {
    return "empty-body";
  }

  if (looksLikeStructuredDataPayload(value)) {
    return "json-body";
  }

  if (looksLikeHtmlDocument(value)) {
    return hasUsefulProductSignals(value) ? "html-with-product-signals" : "html-without-product-signals";
  }

  return "unknown-body";
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCharCode(Number(codePoint)));
}

function cleanText(value: string) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function hostnameLabel(hostname: string) {
  return hostname.replace(/^www\./i, "");
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim());
}

function firstDefinedNumber(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value));
}
