import "server-only";
import { apiRequest } from "@/lib/api/client";
import { type Session, sessionSchema, type User, userSchema } from "@/lib/api/schemas";

export function register(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<Session> {
  return apiRequest({
    path: "/auth/register",
    method: "POST",
    body: input,
    schema: sessionSchema,
  });
}

export function login(input: { email: string; password: string }): Promise<Session> {
  return apiRequest({ path: "/auth/login", method: "POST", body: input, schema: sessionSchema });
}

export function me(token: string): Promise<User> {
  return apiRequest({ path: "/auth/me", token, schema: userSchema, revalidate: false });
}
