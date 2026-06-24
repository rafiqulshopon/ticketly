import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Roles, Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  createReplySchema,
  createTicketSchema,
  listTicketsQuerySchema,
  polishReplySchema,
  updateTicketSchema,
  type CreateReplyInput,
  type CreateTicketInput,
  type ListTicketsQuery,
  type PolishReplyInput,
  type UpdateTicketInput,
} from "@ticketly/shared";
import { auth } from "../auth/auth.config";
import { TicketsService } from "./tickets.service";

/**
 * Ticket creation. The class-level @Roles(["admin", "agent"]) is the access
 * decision for every handler here: the global AuthGuard rejects callers whose
 * session role isn't `admin` or `agent` with 403 before the handler runs. Both
 * are internal staff; creating a ticket is a normal staff action (not privileged
 * like user management). The Phase 3 SendGrid Inbound Parse webhook will be a
 * separate, public (@AllowAnonymous) route that reuses TicketsService directly.
 */
@ApiTags("tickets")
@Controller("tickets")
@Roles(["admin", "agent"])
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @ApiOperation({ summary: "List tickets (server-sorted)" })
  @ApiQuery({ name: "q", required: false, description: "Case-insensitive search on subject or requester email" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "priority", required: false })
  @ApiQuery({ name: "assigneeId", required: false })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["createdAt", "subject", "requesterName", "status"],
    description: "Sort column (default createdAt)",
  })
  @ApiQuery({
    name: "sortDir",
    required: false,
    enum: ["asc", "desc"],
    description: "Sort direction (default desc)",
  })
  @ApiQuery({ name: "page", required: false, type: Number, description: "1-based page (default 1)" })
  @ApiQuery({ name: "pageSize", required: false, type: Number, description: "Page size, 1–100 (default 25)" })
  @Get()
  list(@Query() raw: Record<string, string | undefined>) {
    const query: ListTicketsQuery = listTicketsQuerySchema.parse(raw ?? {});
    return this.tickets.list(query);
  }

  @ApiOperation({ summary: "List staff available for assignment" })
  @Get("assignees")
  listAssignees() {
    return this.tickets.listAssignees();
  }

  @ApiOperation({ summary: "Get a single ticket (metadata only)" })
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tickets.findOne(Number(id));
  }

  @ApiOperation({ summary: "Update a ticket (assignee)" })
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    let input: UpdateTicketInput;
    try {
      input = updateTicketSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid ticket data");
    }
    return this.tickets.update(Number(id), input);
  }

  @ApiOperation({ summary: "Reply to a ticket (append an outbound message)" })
  @Post(":id/replies")
  reply(
    @Param("id") id: string,
    @Body() body: unknown,
    // @Session() is the better-auth param decorator; `session.user.id` is the
    // signed-in agent who becomes the reply's sender. First consumer of @Session
    // in this repo.
    @Session() session: UserSession<typeof auth>,
  ) {
    let input: CreateReplyInput;
    try {
      input = createReplySchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid reply data");
    }
    return this.tickets.reply(Number(id), input, session.user.id);
  }

  @ApiOperation({ summary: "Polish a drafted reply with AI" })
  @Post(":id/polish")
  async polish(
    @Param("id") id: string,
    @Body() body: unknown,
    // The signed-in agent's name signs the polished reply, so it's threaded to
    // the AI service alongside the draft (same @Session pattern as reply()).
    @Session() session: UserSession<typeof auth>,
  ) {
    let input: PolishReplyInput;
    try {
      input = polishReplySchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid polish request");
    }
    return this.tickets.polish(Number(id), input, session.user.name);
  }

  @ApiOperation({ summary: "Create a ticket from an inbound request (email-like)" })
  @Post()
  async create(@Body() body: unknown) {
    let input: CreateTicketInput;
    try {
      input = createTicketSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid ticket data");
    }
    const { ticket } = await this.tickets.create(input);
    return ticket;
  }
}
