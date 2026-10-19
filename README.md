# ReturnDesk — Return Request Management System

**A return request management application built with Next.js, React, PostgreSQL, and Tailwind CSS.**

## Project Links

- **Live application:** Pending deployment
- **GitHub repository:** https://github.com/mandira-g/frido-returndesk

## Overview

ReturnDesk helps manage product return requests through a defined workflow. Users can create requests, search and filter records, review request details, add notes, and manage status transitions.

## Features

- Create return requests with customer, order, item, quantity, and reason details.
- Generate unique, human-readable request references.
- Search by customer name, order number, or reference.
- Filter by status and return reason.
- Sort and paginate results on the server.
- View request details and chronological notes.
- Add notes without editing or deleting existing notes.
- Manage the return lifecycle: Open, In Review, Approved, Rejected, and Completed.
- Support Refund, Replacement, and Store Credit resolutions.
- Prevent duplicate active return requests for the same item on an order.
- Soft-remove eligible requests while retaining database records.
- Seed sample data for development and testing.

## Technology Stack

- Next.js App Router
- React
- JavaScript
- Tailwind CSS
- PostgreSQL
- Supabase PostgreSQL hosting
- Node.js

## Prerequisites

Install Node.js and npm. You also need access to a PostgreSQL database.

## Local Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/mandira-g/frido-returndesk.git
   cd frido-returndesk
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file by copying `.env.example` to `.env.local`.

4. Set `DATABASE_URL` in `.env.local` to your PostgreSQL connection string. Do not commit real credentials.

5. Create the database tables using `database/schema.sql` in your PostgreSQL database.

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open http://localhost:3000.

## Database Setup and Seed Data

The SQL schema is provided in `database/schema.sql`.

After configuring `DATABASE_URL` and creating the tables, run the seed script:

```bash
npm run seed
```

The seed script creates sample return requests and notes for testing. Run it against a suitable development database. Check the script's behavior before running it again, as it may refuse to seed when its records already exist.

## Environment Variables

See `.env.example` for the required environment variables.

- `DATABASE_URL`: PostgreSQL connection string.

Keep `.env.local` private. Never commit database passwords, access tokens, or other secrets.

## Design Decisions

- **Server-side search and filtering:** reduces the need to load all records into the browser.
- **Parameterized SQL queries:** helps prevent SQL injection in query values.
- **Database constraints:** enforce required fields and allowed values.
- **Transactions:** keep request creation and duplicate checks consistent.
- **Soft removal:** retains records rather than permanently deleting them.
- **Append-only notes:** preserve the request's note history.
- **Seed data:** makes it easier to demonstrate the application with realistic workflow states.

## Assumptions

- Return reasons are limited to Damaged, Wrong Item, Size Issue, Not As Described, and Changed Mind.
- A request can progress from Open to In Review, then to Approved or Rejected. Approved requests may progress to Completed.
- Rejected and Completed requests are final.
- Refund approvals require a positive refund amount. Replacement and Store Credit do not use a refund amount.
- A duplicate active request is determined by order number and item name, case-insensitively.

## Incomplete Work and Limitations

Update this section before submission to state any requirements that remain incomplete or any deployment limitations. Do not claim that an untested feature works.

## Time Spent

Approximately **[enter the actual number of hours spent] hours**.

## Deployment

Update this section with the public application URL after deployment. Verify the live application and database before submitting.
