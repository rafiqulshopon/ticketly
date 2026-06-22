import { Injectable } from "@nestjs/common";
import type { UserListItem, UserListResponse } from "@ticketly/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Read-only user directory for the admin "Users" page. Queries the Better Auth
 * `User` table directly; password/account rows are never selected. Mutations
 * (create / role change / ban) are intentionally NOT here — those go through
 * Better Auth's admin plugin so session/cache/auth state stays consistent.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { q?: string; page: number; pageSize: number }): Promise<UserListResponse> {
    const { q, page, pageSize } = opts;

    // Case-insensitive substring match across email + name. Empty/whitespace
    // search returns everyone (the controller trims `q` before calling).
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items: UserListItem[] = rows.map((u) => ({
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
    }));

    return { items, total, page, pageSize };
  }
}
