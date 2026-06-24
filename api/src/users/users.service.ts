import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreateUserInput, EditUserInput, UserListItem, UserListResponse } from "@ticketly/shared";
import { PrismaService } from "../prisma/prisma.service";
import { auth } from "../auth/auth.config";
import { Role, type User } from "../generated/prisma/client";

/**
 * Admin user directory. Reads query the Better Auth `User` table directly
 * (excluding soft-deleted rows); password/account rows are never selected.
 * Mutations go through Better Auth's admin plugin so auth/session state stays
 * consistent: `createUser` (hashes the password + creates the credential
 * `Account`), `adminUpdateUser`/`setUserPassword` (edit), and
 * `revokeUserSessions` + credential drop (soft delete). Role change / ban
 * remain admin-plugin territory and aren't exposed here.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { q?: string; page: number; pageSize: number }): Promise<UserListResponse> {
    const { q, page, pageSize } = opts;

    // Case-insensitive substring match across email + name. Empty/whitespace
    // search returns everyone (the controller trims `q` before calling).
    // Soft-deleted users (deletedAt set) are always excluded.
    const where = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: rows.map((u) => this.toListItem(u)), total, page, pageSize };
  }

  /**
   * Provision a new user (role defaults to `agent`). Better Auth owns the write
   * so the password is hashed and the credential `Account` row is created. We
   * pre-check the email for a clean 409 and re-read afterward to return the
   * full wire shape.
   */
  async create(input: CreateUserInput): Promise<UserListItem> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    try {
      await auth.api.createUser({
        // Role intentionally omitted: Better Auth applies `defaultRole: "agent"`
        // (auth.config.ts) via its user-create hook. The plugin's TS type only
        // knows its built-in roles ("admin" | "user"), so passing "agent" here
        // would not type-check.
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
        },
      });
    } catch {
      throw new BadRequestException("Unable to create user");
    }

    const created = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!created) {
      throw new Error("User was not persisted after creation");
    }
    return this.toListItem(created);
  }

  /**
   * Update an existing user's name/email, and optionally reset their password
   * (only when `input.password` is non-empty). The Better Auth admin endpoints
   * require the caller's session, so the request `headers` (the session cookie)
   * are forwarded into both calls.
   */
  async update(
    id: string,
    input: EditUserInput,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<UserListItem> {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current || current.deletedAt) {
      throw new NotFoundException("User not found");
    }

    // Duplicate-email pre-check → 409, consistent with create(), before Better Auth.
    if (input.email !== current.email) {
      const clash = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (clash) {
        throw new ConflictException("Email already in use");
      }
    }

    // Better Auth's `headers` option is typed as HeadersInit (Record<string,string>);
    // Express header values can be string[]/undefined, so narrow once here.
    const requestHeaders = headers as Record<string, string>;

    // name/email are always present (required) so `data` is never empty.
    await this.callAuth(() =>
      auth.api.adminUpdateUser({
        body: { userId: id, data: { name: input.name, email: input.email } },
        headers: requestHeaders,
      }),
    );

    const newPassword = input.password;
    if (newPassword) {
      await this.callAuth(() =>
        auth.api.setUserPassword({
          body: { userId: id, newPassword },
          headers: requestHeaders,
        }),
      );
    }

    const updated = await this.prisma.user.findUnique({ where: { id } });
    if (!updated) {
      throw new Error("User vanished after update");
    }
    return this.toListItem(updated);
  }

  /**
   * Soft-delete a user: the row is retained (history + FK references stay valid)
   * but the user is locked out and hidden from the directory. Admins can't be
   * deleted. The lock-out is applied before the `deletedAt` flag so a mid-way
   * failure leaves the user locked-out-but-visible (retryable) rather than
   * hidden-but-still-able-to-login:
   *   1. revoke all sessions  -> logged out everywhere
   *   2. drop credentials     -> password sign-in fails ("invalid credentials")
   *   3. unassign tickets     -> released back to the shared inbox
   *   4. set deletedAt        -> hidden from the directory; row retained
   *
   * Ticket unassignment is a single `updateMany` (atomic) and runs before the
   * `deletedAt` flag: once that flag is set this method early-returns `NotFound`,
   * so a step after it would not be retryable. Every step is idempotent
   * (re-running on retry is a no-op), and a deleted user can't be re-assigned
   * (`update()`/`listAssignees()` reject `deletedAt` users).
   *
   * We deliberately do NOT call `auth.api.removeUser` — it hard-deletes the row.
   * `revokeUserSessions` is admin-session-gated, so the controller forwards the
   * request `headers` (the cookie), same as `update()`.
   */
  async delete(
    id: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundException("User not found");
    }
    if (user.role === Role.admin) {
      throw new BadRequestException("Admins cannot be deleted");
    }

    const requestHeaders = headers as Record<string, string>;

    await this.callAuth(() =>
      auth.api.revokeUserSessions({ body: { userId: id }, headers: requestHeaders }),
    );
    await this.prisma.account.deleteMany({ where: { userId: id } });
    await this.prisma.ticket.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Run a server-side Better Auth call and map its `APIError` (duck-typed on a
   * numeric `statusCode`) to a NestJS HttpException so the status survives.
   * Avoids importing the error class by a specific path.
   */
  private async callAuth<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        typeof (err as { statusCode?: unknown }).statusCode === "number"
      ) {
        const e = err as {
          statusCode: number;
          body?: { message?: string; code?: string };
          message?: string;
        };
        throw new HttpException(
          { message: e.body?.message ?? e.message ?? "Auth error", code: e.body?.code },
          e.statusCode,
        );
      }
      throw err;
    }
  }

  /** Map a Prisma `User` row to the wire shape (timestamps → ISO strings). */
  private toListItem(u: User): UserListItem {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      emailVerified: u.emailVerified,
      banned: u.banned,
      banReason: u.banReason,
      // Nest serializes Date -> ISO string; pin the wire shape explicitly so the
      // shared schema (string timestamps) validates cleanly.
      banExpires: u.banExpires ? u.banExpires.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
