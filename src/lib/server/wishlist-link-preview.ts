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
  const siteName = firstNonEmpty(
    metaTags.get("og:site_name"),
    metaTags.get("twitter:site"),
    hostnameLabel(finalUrl.hostname),
  );

  return {
    sourceUrl: finalUrl.toString(),
    siteName,
    title: firstNonEmpty(
      metaTags.get("og:title"),
      metaTags.get("twitter:title"),
      ldJsonProduct?.title,
      extractDocumentTitle(html),
    ),
    imageUrl: normalizeImageUrl(
      firstNonEmpty(
        metaTags.get("og:image:secure_url"),
        metaTags.get("og:image"),
        metaTags.get("twitter:image"),
        ldJsonProduct?.imageUrl,
      ),
      finalUrl,
    ),
    targetPrice: firstDefinedNumber(
      parsePriceValue(
        firstNonEmpty(
          metaTags.get("product:price:amount"),
          metaTags.get("og:price:amount"),
          metaTags.get("price"),
        ),
      ),
      ldJsonProduct?.targetPrice,
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
    const key = firstNonEmpty(getTagAttribute(tag, "property"), getTagAttribute(tag, "name"));
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
    return value.find((item) => typeof item === "string") as string | undefined;
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
    return parsePriceValue(candidate.price);
  }

  return parsePriceValue(value);
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
