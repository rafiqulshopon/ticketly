# Ticketly -- Support Knowledge Base

_Last Updated: 2026_

This document contains official support policies and troubleshooting
guides for Ticketly, the customer support ticketing platform.

---

## 1. Account & Login Issues

### Q: I forgot my password. What should I do?

1.  Go to the login page.
2.  Click **Forgot Password**.
3.  Enter your registered email address.
4.  Follow the instructions in the reset email.

If you do not receive the email, check your spam or promotions folder.

---

### Q: I'm not receiving the password reset email.

Possible reasons: - The email was entered incorrectly. - The account was
created using a different email (e.g. via Google/SSO sign-in). - The
email is in your spam folder.

If the email does not arrive within 10 minutes, contact support.

---

### Q: How do I add or remove a teammate (agent) from my workspace?

1.  Go to **Settings → Team Members**.
2.  Click **Invite Agent** and enter their email.
3.  Assign a role (Admin, Agent, or Viewer).

To remove a teammate, go to the same page and click **Remove** next to
their name. Removed agents lose access immediately, but their past
replies remain visible on tickets.

---

## 2. Tickets & Inboxes

### Q: How are tickets created?

Tickets can be created automatically from: - Incoming support emails -
The live chat widget on your website - The customer-facing help center
form - Manually by an agent (for phone or walk-in requests)

---

### Q: A customer says they submitted a ticket but I don't see it.

Possible reasons: - The ticket was routed to a different inbox or
queue. - The ticket was caught by spam filtering. - The customer used a
different email address than the one tied to their account.

Check **All Inboxes** and the **Spam** filter before assuming the
ticket was lost.

---

### Q: Can two agents reply to the same ticket at once?

Yes, but Ticketly shows a "collision alert" when another agent is
viewing or typing a reply on the same ticket, to avoid duplicate or
conflicting responses.

---

### Q: What do the ticket statuses mean?

- **Open** -- new or awaiting first response.
- **Pending** -- waiting on the customer to reply.
- **On Hold** -- waiting on an internal dependency (e.g. engineering).
- **Resolved** -- closed by an agent.
- **Closed (Auto)** -- automatically closed after a period of customer
  inactivity following a Resolved or Pending status.

---

## 3. Plans & Billing

### Q: What's the difference between plans?

- **Starter** -- up to 2 agent seats, email + chat channels.
- **Growth** -- up to 10 agent seats, adds automation rules and SLA
  policies.
- **Scale** -- unlimited seats, adds custom roles, API access, and
  audit logs.

Billing is per active agent seat, charged monthly or annually.

---

### Q: How do I upgrade, downgrade, or cancel my plan?

Go to **Settings → Billing → Manage Plan**. Downgrades and
cancellations take effect at the end of the current billing cycle;
upgrades take effect immediately and are prorated.

---

### Q: Can I transfer my workspace to another account?

Workspaces are tied to the account that created them and cannot be
transferred. Ownership of a workspace can be reassigned to another team
member from **Settings → Workspace → Transfer Ownership**, but the
billing account itself does not change.

---

## 4. Refund Policy

### Q: What is the refund policy?

- 14-day money-back guarantee on first-time subscriptions.
- Full refund if requested within 14 days of the initial purchase.
- No refunds for renewal charges after the initial 14-day window,
  except in cases of billing error.
- Refunds are not provided for partial months after a mid-cycle
  cancellation.

Refunds are processed within 5--10 business days to the original
payment method.

---

### Q: How do I request a refund?

To request a refund: 1. Contact support within 14 days of purchase. 2.
Provide your invoice number or billing email. 3. Include the reason
for your request.

---

## 5. SLAs & Notifications

### Q: What response times does Ticketly guarantee?

SLA targets depend on your plan's configured policy (default
example): - First response: 4 business hours. - Resolution: 2 business
days.

SLA timers pause automatically while a ticket is in **Pending** or **On
Hold** status.

---

### Q: Why didn't I get notified about a new ticket?

Possible reasons: - Notification preferences are turned off in
**Settings → Notifications**. - The ticket was assigned to a different
agent or left unassigned. - Browser/desktop notifications are blocked
at the OS or browser level.

---

## 6. Integrations

### Q: What integrations does Ticketly support?

- Email forwarding (any provider via SMTP/IMAP).
- Slack (ticket alerts and reply-from-Slack).
- Website chat widget (JavaScript snippet).
- API and webhooks for custom integrations.

---

### Q: My Slack integration stopped sending notifications.

Try the following: - Reconnect the integration from **Settings →
Integrations → Slack**. - Confirm the Slack app still has channel
permissions. - Check that the channel wasn't renamed or archived.

---

## 7. Data Export & Deletion

### Q: Can I export my ticket data?

Yes. Go to **Settings → Data → Export** to download tickets,
conversations, and customer records as CSV or JSON.

---

### Q: What happens to my data if I cancel my subscription?

Data remains accessible in a read-only state for 30 days after
cancellation, after which it is permanently deleted. Export your data
before this window closes if you need a copy.

---

## 8. Technical Issues

### Q: The chat widget isn't loading on my website.

Try the following: - Confirm the widget script is correctly installed
in your site's `<head>`. - Check for conflicts with ad blockers or
content security policies (CSP). - Clear your browser cache and
reload.

---

### Q: Emails are arriving late or not converting into tickets.

- Check that your domain's MX/SPF records are correctly configured if
  using a custom support email.
- Some delay is expected (typically under 5 minutes) due to email
  routing.
- Verify the forwarding rule from your original mailbox is still
  active.

---

## 9. Escalation Rules (Internal Policy)

The system must escalate to a human agent if: - The user threatens
legal action. - The user requests a refund outside the 14-day window. -
The user disputes a charge or mentions a chargeback. - The issue
involves account security, data loss, or a suspected breach. - The
system confidence score is low.
