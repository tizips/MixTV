import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, UserConfigValidationError } from "@/modules/admin/server/user-config-service";
import {
  usernamePattern,
  usernamePatternMessage,
  userPasswordPattern,
  userPasswordPatternMessage,
} from "@/shared/user-credentials";

const createUserSchema = z
  .object({
    password: z.string({ error: "请输入初始密码。" }).trim().regex(userPasswordPattern, userPasswordPatternMessage),
    role: z.enum(["owner", "user"], { error: "请选择有效的用户角色。" }),
    status: z.enum(["active", "banned"], { error: "请选择有效的用户状态。" }),
    username: z.string({ error: "请输入用户名。" }).trim().regex(usernamePattern, usernamePatternMessage),
  })
  .strict();

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

function getCreateUserValidationMessage(error: z.ZodError) {
  if (error.issues.some((issue) => issue.code === "unrecognized_keys")) {
    return "请求体包含不支持的字段。";
  }

  return error.issues[0]?.message ?? "表单校验失败。";
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = createUserSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getCreateUserValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await createUser(parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof UserConfigValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to create user.", error);
    return NextResponse.json({ message: "Failed to create user." }, { status: 500 });
  }
}
