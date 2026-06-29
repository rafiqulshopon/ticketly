-- CreateEnum
CREATE TYPE "TicketActivityType" AS ENUM ('ticket_created', 'customer_replied', 'agent_replied', 'ai_replied', 'status_changed', 'priority_changed', 'category_changed', 'assignee_changed');

-- CreateTable
CREATE TABLE "ticket_activities" (
    "id" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "type" "TicketActivityType" NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "changeField" TEXT,
    "changeFrom" TEXT,
    "changeTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_activities_ticketId_createdAt_idx" ON "ticket_activities"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_activities_actorUserId_idx" ON "ticket_activities"("actorUserId");

-- AddForeignKey
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

