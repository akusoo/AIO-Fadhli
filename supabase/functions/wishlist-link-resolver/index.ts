// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  getHostedWishLinkPreviewDiagnostics,
  isHostedWishLinkPreviewRecoverableError,
  resolveHostedWishLinkPreview,
} from "../../../src/lib/shared/wishlist-link-preview-hosted.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method tidak didukung." }, 405);
  }

  const authError = assertAuthorization(request);

  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return jsonResponse({ error: "Isi link produk dulu." }, 400);
    }

    const startedAt = Date.now();
    const resolved = await resolveHostedWishLinkPreview(url);

    console.info("wishlist-link-resolver success", {
      elapsedMs: Date.now() - startedAt,
      diagnostics: resolved.diagnostics,
      host: new URL(url).hostname,
      sourceUrl: url,
    });

    return jsonResponse({ item: resolved.item }, 200);
  } catch (error) {
    const diagnostics = getHostedWishLinkPreviewDiagnostics(error);

    console.warn("wishlist-link-resolver failed", {
      diagnostics,
      message: error instanceof Error ? error.message : String(error),
    });

    const status = isHostedWishLinkPreviewRecoverableError(error) ? 422 : 500;
    return jsonResponse(
      {
        diagnostics,
        error: error instanceof Error ? error.message : "Gagal mengambil data dari link.",
      },
      status,
    );
  }
});

function assertAuthorization(request: Request) {
  const expectedToken = Deno.env.get("WISHLIST_LINK_RESOLVER_TOKEN")?.trim();

  if (!expectedToken) {
    return null;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const actualToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (actualToken === expectedToken) {
    return null;
  }

  return jsonResponse({ error: "Unauthorized." }, 401);
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
    status,
  });
}
