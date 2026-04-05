import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type WishLinkPreview = {
  imageUrl?: string;
  siteName?: string;
  sourceUrl: string;
  targetPrice?: number;
  title?: string;
};

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 5_000;
const BROWSER_LIKE_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
};

export async function resolveWishLinkPreview(input: string): Promise<WishLinkPreview> {
  const initialUrl = parsePublicHttpUrl(input);
  const response = await fetchHtmlWithRedirects(initialUrl);
  const html = await response.text();
  const metaTags = collectMetaTags(html);
  const ldJsonProduct = extractLdJsonProduct(html);
  const finalUrl = response.url ? new URL(response.url) : initialUrl;
  const documentTitle = extractDocumentTitle(html);
  const titleHints = [
    metaTags.get("og:title"),
    metaTags.get("twitter:title"),
    documentTitle,
  ].flatMap((value) => (value ? [value] : []));
  const siteName = firstNonEmpty(
    metaTags.get("og:site_name"),
    metaTags.get("twitter:site"),
    hostnameLabel(finalUrl.hostname),
  );
  const preferredEmbeddedProduct = extractEmbeddedProductData(html, { finalUrl, titleHints });
  const inlinePatternProduct = extractHtmlPatternData(html);

  return {
    sourceUrl: finalUrl.toString(),
    siteName,
    title: firstNonEmpty(
      metaTags.get("og:title"),
      metaTags.get("twitter:title"),
      ldJsonProduct?.title,
      preferredEmbeddedProduct?.title,
      documentTitle,
    ),
    imageUrl: normalizeImageUrl(
      firstNonEmpty(
        metaTags.get("og:image:secure_url"),
        metaTags.get("og:image:url"),
        metaTags.get("og:image"),
        metaTags.get("twitter:image:src"),
        metaTags.get("twitter:image"),
        metaTags.get("image"),
        ldJsonProduct?.imageUrl,
        preferredEmbeddedProduct?.imageUrl,
        inlinePatternProduct.imageUrl,
      ),
      finalUrl,
    ),
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
      preferredEmbeddedProduct?.targetPrice,
      inlinePatternProduct.targetPrice,
    ),
  };
}

export function createWishLinkPreviewFallback(input: string): WishLinkPreview {
  const url = parsePublicHttpUrl(input);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const slug = pathSegments.at(-1);

  return {
    sourceUrl: url.toString(),
    siteName: hostnameLabel(url.hostname),
    title: slug ? humanizeSlug(slug) : undefined,
  };
}

async function fetchHtmlWithRedirects(initialUrl: URL) {
  let currentUrl = initialUrl;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    await assertPublicHostname(currentUrl.hostname);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        cache: "no-store",
        headers: BROWSER_LIKE_HEADERS,
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

      if (!response.ok) {
        throw new Error("Link tidak bisa diambil sekarang.");
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new Error("Link ini belum bisa dibaca sebagai halaman produk.");
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Link sedang lambat dibaca. Coba tempel ulang atau isi manual dulu.");
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Redirect link terlalu banyak.");
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

async function assertPublicHostname(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname.endsWith(".local") ||
    normalizedHostname.endsWith(".internal")
  ) {
    throw new Error("Link lokal atau internal tidak didukung.");
  }

  if (isIP(normalizedHostname) && isPrivateAddress(normalizedHostname)) {
    throw new Error("Link privat tidak didukung.");
  }

  const addresses = await lookup(normalizedHostname, { all: true, verbatim: true }).catch(() => {
    throw new Error("Host link tidak bisa diakses.");
  });

  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Link privat tidak didukung.");
  }
}

function isPrivateAddress(address: string) {
  const ipVersion = isIP(address);

  if (ipVersion === 4) {
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

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();

    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
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

function extractEmbeddedProductData(
  html: string,
  signals: { finalUrl: URL; titleHints: string[] },
) {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const candidates: Array<Record<string, unknown>> = [];

  for (const script of scripts) {
    const contentMatch = script.match(/<script[^>]*>([\s\S]*?)<\/script>/i);

    if (!contentMatch?.[1]) {
      continue;
    }

    const content = decodeHtmlEntities(contentMatch[1].trim());
    const payloads = extractStructuredDataPayloads(content);

    for (const payload of payloads) {
      candidates.push(...collectProductLikeData(payload));
    }
  }

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

  const jsonParseMatches =
    content.matchAll(/JSON\.parse\(("(?:\\.|[^"\\])*")\)/g);

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

function collectProductLikeData(
  value: unknown,
  seen = new Set<object>(),
): Array<Record<string, unknown>> {
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

    if (
      normalizedTitle.includes(normalizedHint) ||
      normalizedHint.includes(normalizedTitle)
    ) {
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
  const enrichment = asRecord(candidate.enrichment);
  const enrichmentImages = asRecord(enrichment?.images);

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
    extractImageValue(enrichmentImages),
    extractImageValue(enrichmentImages?.primary_image),
    typeof enrichmentImages?.primary_image_url === "string"
      ? cleanText(enrichmentImages.primary_image_url)
      : undefined,
    typeof enrichmentImages?.primaryImageUrl === "string"
      ? cleanText(enrichmentImages.primaryImageUrl)
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
      const integerPart = numeric
        .slice(0, separatorIndex)
        .replace(/[^\d]/g, "");
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

function humanizeSlug(value: string) {
  return decodeURIComponent(value)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim());
}

function firstDefinedNumber(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value));
}
