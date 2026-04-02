import {
  createWishLinkPreviewFallback,
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

    try {
      item = await resolveWishLinkPreview(url);
    } catch (error) {
      if (isRecoverableLinkPreviewError(error)) {
        item = createWishLinkPreviewFallback(url);
      } else {
        throw error;
      }
    }

    return okJson({ item }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengambil data dari link.",
      400,
      context.applyCookies,
    );
  }
}

function isRecoverableLinkPreviewError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "Link tidak bisa diambil sekarang.",
    "Link ini belum bisa dibaca sebagai halaman produk.",
    "Link sedang lambat dibaca. Coba tempel ulang atau isi manual dulu.",
  ].includes(error.message);
}
