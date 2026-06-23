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
 * Input for provisioning a new user from the admin UI. Drives both the form
 * (react-hook-form resolver) and the POST /users body parse. Role is not part
 * of the payload — new users default to `agent` server-side.
 */
export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

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
