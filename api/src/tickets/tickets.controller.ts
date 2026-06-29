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
import { TicketsService, type TicketCaller } from "./tickets.service";

/**
 * Resolve the access-scoping identity from the better-auth session: the user id
 * (agents are limited to tickets assigned to them) and the admin flag (admins
 * see/act on all). Shared by every ticket list + per-ticket handler so the
 * scoping is consistent and can't drift between endpoints.
 */
function toCaller(session: UserSession<typeof auth>): TicketCaller {
  const role = session.user.role;
  const isAdmin = Array.isArray(role) ? role.includes("admin") : role === "admin";
  return { userId: session.user.id, isAdmin };
}

/**
 * Ticket creation. The class-level @Roles(["admin", "agent"]) is the access
 * decision for every handler here: the global AuthGuard rejects callers whose
 * session role isn't `admin` or `agent` with 403 before the handler runs. Both
 * are internal staff; creating a ticket is a normal staff action (not privileged
 * like user management). The Resend inbound webhook is a separate, public
 * (@AllowAnonymous) route that reuses TicketsService directly.
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
    name: "view",
    required: false,
    enum: ["all", "open", "resolvedByAi"],
    description: "Dashboard bucket deep-link: all (incl. pipeline), open (not resolved), resolvedByAi. Ignored when status is set.",
  })
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
  list(
    @Query() raw: Record<string, string | undefined>,
    @Session() session: UserSession<typeof auth>,
  ) {
    const query: ListTicketsQuery = listTicketsQuerySchema.parse(raw ?? {});
    // The list is scoped by the caller: agents see only their own assigned
    // tickets, admins see the whole inbox. The service also hides the AI
    // pipeline states (NEW/PROCESSING) from agents — both are enforced
    // server-side from the identity resolved here, so neither can be bypassed.
    return this.tickets.list(query, toCaller(session));
  }

  @ApiOperation({ summary: "List staff available for assignment" })
  @Get("assignees")
  listAssignees() {
    return this.tickets.listAssignees();
  }

  @ApiOperation({ summary: "List activity log entries for a ticket (newest first)" })
  @Get(":id/activity")
  listActivity(
    @Param("id") id: string,
    @Session() session: UserSession<typeof auth>,
  ) {
    // Access-scoped inside the service (assertAccess): agents get 404 for tickets
    // not assigned to them, same as findOne.
    return this.tickets.listActivity(Number(id), toCaller(session));
  }

  @ApiOperation({ summary: "Get a single ticket (metadata only)" })
  @Get(":id")
  findOne(
    @Param("id") id: string,
    @Session() session: UserSession<typeof auth>,
  ) {
    return this.tickets.findOne(Number(id), toCaller(session));
  }

  @ApiOperation({ summary: "Update a ticket (assignee)" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Session() session: UserSession<typeof auth>,
  ) {
    let input: UpdateTicketInput;
    try {
      input = updateTicketSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid ticket data");
    }
    return this.tickets.update(Number(id), input, toCaller(session));
  }

  @ApiOperation({ summary: "Reply to a ticket (append an outbound message)" })
  @Post(":id/replies")
  reply(
    @Param("id") id: string,
    @Body() body: unknown,
    // @Session() is the better-auth param decorator; `session.user.id` is the
    // signed-in agent who becomes the reply's sender, and toCaller() scopes the
    // call to their own tickets.
    @Session() session: UserSession<typeof auth>,
  ) {
    let input: CreateReplyInput;
    try {
      input = createReplySchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid reply data");
    }
    return this.tickets.reply(Number(id), input, session.user.id, toCaller(session));
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
    return this.tickets.polish(Number(id), input, session.user.name, toCaller(session));
  }

  @ApiOperation({ summary: "Summarize a ticket and its conversation with AI" })
  @Post(":id/summarize")
  summarize(
    @Param("id") id: string,
    @Session() session: UserSession<typeof auth>,
  ) {
    // No request body — the endpoint is keyed by the ticket id alone and reads
    // the thread server-side. The summary is regenerated on every call.
    return this.tickets.summarize(Number(id), toCaller(session));
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
