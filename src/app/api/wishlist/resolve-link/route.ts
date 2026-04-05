import {
  createWishLinkPreviewFallback,
  getWishLinkPreviewDiagnostics,
  isRecoverableWishLinkPreviewError,
  resolveWishLinkPreview,
} from "@/lib/server/wishlist-link-preview";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      throw new Error("Isi link produk dulu.");
    }

    let item;
    let resolution: "fallback" | "parsed" = "parsed";

    try {
      item = await resolveWishLinkPreview(url);
    } catch (error) {
      if (isRecoverableWishLinkPreviewError(error)) {
        resolution = "fallback";
        console.warn("Wishlist link preview fell back to URL metadata.", {
          diagnostics: getWishLinkPreviewDiagnostics(error),
          message: error instanceof Error ? error.message : String(error),
          sourceUrl: url,
        });
        item = createWishLinkPreviewFallback(url);
      } else {
        throw error;
      }
    }

    return okJson({ item, resolution }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengambil data dari link.",
      400,
      context.applyCookies,
    );
  }
}
