# identity-reconciliation

## Description
This service implements an identity reconciliation API using Express and Prisma. It maintains a contact registry where incoming identifiers (email or phone number) are linked to a primary contact, consolidating duplicates and tracking secondary contacts.

## Features
- Create or reconcile contacts based on email and/or phone number
- Automatically designate primary and secondary contacts
- Retrieve all contacts

## Tech Stack
- Node.js (v16+)
- Express
- Prisma ORM (PostgreSQL)

## Prerequisites
- Node.js and npm installed
- PostgreSQL database instance

## Setup
1. Clone the repository:
   ```cmd
   git clone <repo-url> identity-reconciliation
   cd identity-reconciliation
   ```
2. Install dependencies:
   ```cmd
   npm install
   ```
3. Create a `.env` file in the root with the following:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
   ```
4. Run Prisma migrations to set up the schema:
   ```cmd
   npx prisma migrate dev --name init
   ```

## Running the Server
```cmd
npm run build   # if using TypeScript build step
npm start       # or `node dist/server.js`
```
By default, the server listens on port `3000`. You can override with `PORT` env variable.

## API Endpoints

### POST /identify
Reconcile or create a contact.

Request Body (JSON):
```json
{
  "email": "user@example.com",    // optional
  "phoneNumber": "+123456789"     // optional
}
```
The request must include at least one of `email` or `phoneNumber`.

Success Response (200):
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com"],
    "phoneNumbers": ["+123456789"],
    "secondaryContactIds": []
  }
}
```
- If no existing match is found, a new primary contact is created.
- If matches exist, they are consolidated under the oldest primary record; new identifiers become secondary if needed.

Errors:
- `400 Bad Request`: missing both `email` and `phoneNumber`.
- `500 Internal Server Error`: unexpected errors.

### GET /contacts
Retrieve the full list of contacts.

Success Response (200):
```json
{
  "contacts": [
    {
      "id": 1,
      "email": "user@example.com",
      "phoneNumber": "+123456789",
      "linkPrecedence": "primary",
      "linkedId": null,
      "createdAt": "2025-05-28T20:37:27.000Z",
      "updatedAt": "2025-05-28T20:37:27.000Z"
    },
    // ... more contacts
  ]
}
```

## Database Schema (Prisma)
```prisma
model Contact {
  id              Int       @id @default(autoincrement())
  phoneNumber     String?   @db.VarChar(255)
  email           String?   @db.VarChar(255)
  linkedId        Int?
  linkPrecedence  String    @default("primary")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  primaryContact    Contact?   @relation("SecondaryContacts", fields: [linkedId], references: [id])
  secondaryContacts Contact[]  @relation("SecondaryContacts")
}
```


