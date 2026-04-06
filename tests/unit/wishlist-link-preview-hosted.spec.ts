import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveHostedWishLinkPreview } from "@/lib/shared/wishlist-link-preview-hosted";

const fixturePath = path.join(process.cwd(), "tests/fixtures/wishlist/product.html");
const productFixture = fs.readFileSync(fixturePath, "utf8");

function createResponse(
  body: string,
  url: string,
  options?: { contentType?: string; status?: number },
) {
  const response = new Response(body, {
    status: options?.status ?? 200,
    headers: {
      "content-type": options?.contentType ?? "text/html; charset=utf-8",
    },
  });

  Object.defineProperty(response, "url", {
    configurable: true,
    value: url,
  });

  return response;
}

describe("wishlist hosted link preview", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  it("extracts title, image, site, and price from direct HTML metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(productFixture, "https://www.tokopedia.com/fadhli/keyboard-wireless"),
    );

    await expect(
      resolveHostedWishLinkPreview("https://www.tokopedia.com/fadhli/keyboard-wireless"),
    ).resolves.toMatchObject({
      item: {
        imageUrl: "https://images.example.com/keyboard.jpg",
        siteName: "Tokopedia",
        sourceUrl: "https://www.tokopedia.com/fadhli/keyboard-wireless",
        targetPrice: 1_350_000,
        title: "Mechanical Keyboard Wireless",
      },
    });
  });

  it("retries Shopee with alternate fetch profiles until metadata is available", async () => {
    const requestedUserAgents: string[] = [];
    const shopeeUrl =
      "https://shopee.co.id/Jas-Hujan-Stelan-Series-Shine-Mantel-Baju-Celana-Raincoat-Set-Ultralight-Raincoat-Waterproof-i.286504037.29038098149";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const userAgent = headers["User-Agent"] ?? "";
      requestedUserAgents.push(userAgent);

      if (userAgent === "Twitterbot/1.0") {
        return createResponse(
          `
            <html>
              <head>
                <title>Halaman Tidak Tersedia</title>
              </head>
              <body>Maaf, telah terjadi kesalahan. Silakan log in dan coba lagi.</body>
            </html>
          `,
          shopeeUrl,
        );
      }

      return createResponse(
        `
          <html>
            <head>
              <title>Jual Jas Hujan Stelan Series Shine / Mantel Baju Celana / Raincoat Set Ultralight / Raincoat Waterproof | Shopee Indonesia</title>
              <meta property="og:title" content="Jual Jas Hujan Stelan Series Shine / Mantel Baju Celana / Raincoat Set Ultralight / Raincoat Waterproof | Shopee Indonesia" />
              <meta property="og:image" content="https://down-id.img.susercontent.com/file/id-11134207-7ra0j-mbhg5v94na0412" />
              <script type="application/ld+json">
                {
                  "@context": "http://schema.org",
                  "@type": "Product",
                  "name": "Jas Hujan Stelan Series Shine / Mantel Baju Celana / Raincoat Set Ultralight / Raincoat Waterproof",
                  "image": "https://down-id.img.susercontent.com/file/id-11134207-7ra0j-mbhg5v94na0412",
                  "offers": {
                    "@type": "Offer",
                    "price": "235000.00",
                    "priceCurrency": "IDR"
                  }
                }
              </script>
            </head>
          </html>
        `,
        shopeeUrl,
      );
    });

    await expect(resolveHostedWishLinkPreview(shopeeUrl)).resolves.toMatchObject({
      item: {
        imageUrl: "https://down-id.img.susercontent.com/file/id-11134207-7ra0j-mbhg5v94na0412",
        siteName: "shopee.co.id",
        sourceUrl: shopeeUrl,
        targetPrice: 235_000,
        title:
          "Jual Jas Hujan Stelan Series Shine / Mantel Baju Celana / Raincoat Set Ultralight / Raincoat Waterproof | Shopee Indonesia",
      },
    });

    expect(requestedUserAgents).toEqual([
      "Twitterbot/1.0",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    ]);
  });

  it("retries with a stripped canonical URL when tracking params time out", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestedUrl = new URL(String(input));

      if (requestedUrl.searchParams.has("t_id")) {
        const timeoutError = new Error("timed out");
        timeoutError.name = "AbortError";
        throw timeoutError;
      }

      return createResponse(
        `
          <html>
            <head>
              <meta property="og:title" content="Gravel Bike Police Toronto" />
              <meta property="og:image" content="https://images.example.com/gravel-bike.jpg" />
              <meta property="product:price:amount" content="2950000" />
            </head>
          </html>
        `,
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
      );
    });

    await expect(
      resolveHostedWishLinkPreview(
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096?t_id=1775382826980&t_st=1",
      ),
    ).resolves.toMatchObject({
      item: {
        imageUrl: "https://images.example.com/gravel-bike.jpg",
        sourceUrl:
          "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
        targetPrice: 2_950_000,
        title: "Gravel Bike Police Toronto",
      },
    });
  });
});
