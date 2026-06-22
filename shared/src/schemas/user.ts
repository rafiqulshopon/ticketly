import { z } from "zod";

export const userRoleEnum = z.enum(["admin", "agent"]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleEnum,
});

export type User = z.infer<typeof userSchema>;
export type UserRole = z.infer<typeof userRoleEnum>;

/**
 * Admin user-management view. Mirrors the Better Auth / Prisma `User` row but as
 * a wire shape (timestamps are ISO strings — Nest serializes Dates that way).
 * Password/account fields are intentionally excluded.
 */
export const userListItemSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleEnum,
  emailVerified: z.boolean(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  banExpires: z.string().nullable(),
  createdAt: z.string(),
});

export const userListResponseSchema = z.object({
  items: z.array(userListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type UserListItem = z.infer<typeof userListItemSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
