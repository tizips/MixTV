import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteUser, updateUser, UserConfigValidationError } from "@/modules/admin/server/user-config-service";
import { userPasswordPattern, userPasswordPatternMessage } from "@/shared/user-credentials";

type RouteContext = {
  params: Promise<{ username: string }>;
};

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

const updateUserSchema = z
  .object({
    password: z.string().trim().regex(userPasswordPattern, userPasswordPatternMessage).optional(),
    role: z.enum(["owner", "user"], { error: "请选择有效的用户角色。" }).optional(),
    status: z.enum(["active", "banned"], { error: "请选择有效的用户状态。" }).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "user patch is required.",
  });

function getUpdateUserValidationMessage(error: z.ZodError) {
  if (error.issues.some((issue) => issue.code === "unrecognized_keys")) {
    return "请求体包含不支持的字段。";
  }

  return error.issues[0]?.message ?? "表单校验失败。";
}

export async function PUT(request: Request, context: RouteContext) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return badRequest("Request body must be an object.");
  }

  const parsed = updateUserSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getUpdateUserValidationMessage(parsed.error));
  }

  try {
    const { username } = await context.params;
    return NextResponse.json(await updateUser(username, parsed.data));
  } catch (error) {
    if (error instanceof UserConfigValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to update user.", error);
    return NextResponse.json({ message: "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { username } = await context.params;
    return NextResponse.json(await deleteUser(username));
  } catch (error) {
    if (error instanceof UserConfigValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to delete user.", error);
    return NextResponse.json({ message: "Failed to delete user." }, { status: 500 });
  }
}
