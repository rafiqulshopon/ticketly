import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { Roles } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createTicketSchema, type CreateTicketInput } from "@ticketly/shared";
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
