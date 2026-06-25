import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SYSTEM_AGENT_EMAIL } from "../tickets/tickets.constants";

/**
 * Resolves the id of the system "AI" agent — a bare `User` provisioned by the seed
 * — cached after the first hit. Looked up by email because the seed generates the
 * id (a UUID, not a fixed value). Returns null if the agent isn't seeded yet;
 * callers treat that as a no-op (leave a ticket unassigned, attribute a reply to
 * no one) rather than failing. Re-queries until the seed lands, so a late seed is
 * picked up with no restart.
 */
@Injectable()
export class SystemAgentService {
  private aiAgentId?: string;

  constructor(private readonly prisma: PrismaService) {}

  async getAiAgentId(): Promise<string | null> {
    if (this.aiAgentId) return this.aiAgentId;
    const ai = await this.prisma.user.findUnique({
      where: { email: SYSTEM_AGENT_EMAIL },
      select: { id: true },
    });
    if (ai) this.aiAgentId = ai.id;
    return ai?.id ?? null;
  }
}
