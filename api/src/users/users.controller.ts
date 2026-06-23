import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { Roles } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { createUserSchema, type CreateUserInput } from "@ticketly/shared";
import { z } from "zod";
import { UsersService } from "./users.service";

/**
 * Admin-only user directory. The class-level @Roles(["admin"]) is the access
 * decision for every handler here: the global AuthGuard rejects anyone whose
 * session role isn't `admin` with 403 before the handler runs.
 */
@ApiTags("users")
@Controller("users")
@Roles(["admin"])
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOperation({ summary: "List users (admin only)" })
  @ApiQuery({ name: "q", required: false, description: "Case-insensitive search on email or name" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "1-based page (default 1)",
  })
  @ApiQuery({
    name: "pageSize",
    required: false,
    type: Number,
    description: "Page size, 1–100 (default 20)",
  })
  @Get()
  list(@Query() raw: Record<string, string | undefined>) {
    const { q, page, pageSize } = listUsersQuerySchema.parse(raw ?? {});
    return this.users.list({ q, page, pageSize });
  }

  @ApiOperation({ summary: "Create a user (admin only; defaults to role agent)" })
  @Post()
  create(@Body() body: unknown) {
    let input: CreateUserInput;
    try {
      input = createUserSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid user data");
    }
    return this.users.create(input);
  }
}

// Query params arrive as strings; coerce + clamp with sane bounds. Empty strings
// (e.g. `?q=`) are normalized to undefined so they don't trip `.min(1)`.
const listUsersQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  page: optionalInt(1, 1),
  pageSize: optionalInt(20, 1, 100),
});

function optionalInt(def: number, min: number, max = Number.POSITIVE_INFINITY) {
  return z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? undefined : v),
    z.coerce.number().int().min(min).max(max).default(def),
  );
}
