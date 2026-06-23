import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Roles } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  createTicketSchema,
  listTicketsQuerySchema,
  type CreateTicketInput,
  type ListTicketsQuery,
} from "@ticketly/shared";
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

  @ApiOperation({ summary: "Get a single ticket (metadata only)" })
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tickets.findOne(Number(id));
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
