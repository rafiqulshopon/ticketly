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

// Shared field rules (used by both createUserSchema and editUserSchema).
// Internal spaces are allowed in names ("Mary Jane"), but leading/trailing
// whitespace and whitespace-only values are rejected.
const nameField = z
  .string()
  .min(3, "Name must be at least 3 characters")
  .refine((value) => value === value.trim(), {
    message: "Name cannot start or end with a space",
  });

const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email")
  .refine((value) => !/\s/.test(value), { message: "Email cannot contain spaces" });

// Base password rule: ≥8 chars, no whitespace. create requires it; edit makes it
// optional (empty/undefined = leave the password unchanged).
const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => !/\s/.test(value), {
    message: "Password cannot contain spaces",
  });

/**
 * Input for provisioning a new user from the admin UI. Drives both the form
 * (react-hook-form resolver) and the POST /users body parse. Role is not part
 * of the payload — new users default to `agent` server-side.
 */
export const createUserSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordRule,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Input for editing an existing user. Same name/email rules as create. Password
 * is optional — empty/undefined means "leave unchanged"; if provided it must be
 * ≥8 chars with no whitespace. Role is not editable here.
 */
export const editUserSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordRule.optional().or(z.literal("")),
});

export type EditUserInput = z.infer<typeof editUserSchema>;

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
