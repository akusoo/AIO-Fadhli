import type { AddProjectInput } from "@/lib/domain/models";
import { buildAppSnapshot } from "@/lib/server/app-backend";
import { createId } from "@/lib/utils";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddProjectInput & { clientId?: string };
    const createdProject = {
      id: body.clientId ?? createId("proj"),
      user_id: context.user.id,
      name: body.name,
      description: body.description,
      focus: body.focus,
      status: "active",
    };

    const { error } = await context.supabase.from("projects").insert(createdProject);
    if (error) {
      throw error;
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson(
      {
        snapshot,
        item: {
          id: createdProject.id,
          name: createdProject.name,
          description: createdProject.description,
          focus: createdProject.focus,
          status: createdProject.status,
        },
      },
      context.applyCookies,
    );
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah project.",
      400,
      context.applyCookies,
    );
  }
}
