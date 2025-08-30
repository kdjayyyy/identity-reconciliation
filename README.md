# Identity Reconciliation Service

This is a customer identity management service that helps in identifying and consolidating customer contact information. The service exposes an `/identify` endpoint that takes an email and/or a phone number and returns a consolidated contact profile.

## Tech Stack

- **Backend:** Node.js with Express.js
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Containerization:** Docker

## Prerequisites

Make sure you have the following installed on your local machine:

- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Docker](https://www.docker.com/get-started) and Docker Compose
- [npm](https://www.npmjs.com/get-npm) (or any other package manager like yarn or pnpm)

## Getting Started

Follow these steps to get the application up and running.

### 1. Clone the Repository

```bash
git clone https://github.com/kdjayyyy/identity-reconciliation.git
cd identity-reconciliation
```

### 2. Create Environment File

Create a `.env` file in the root of the project and add the following environment variable. This is the connection string for the PostgreSQL database that will be running in a Docker container.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bitespeed?schema=public"
```

### 3. Start the Database

Run the following command to start the PostgreSQL database in a Docker container:

```bash
docker-compose up -d
```

This will start a PostgreSQL server on port `5432`.

### 4. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

### 5. Run Database Migrations

Apply the database schema to your PostgreSQL database using Prisma Migrate:

```bash
npm run migrate
```

This command will create the `Contact` table in your `bitespeed` database.

## Running the Application

You can run the application in either development or production mode.

### Development Mode

To run the application in development mode with hot-reloading, use:

```bash
npm run dev
```

The server will start on `http://localhost:3000`.

### Production Mode

To build and run the application for production, use the following commands:

```bash
npm run build
npm run start
```

The server will start on `http://localhost:3000`.

## API Endpoint

The service provides a single endpoint to identify and link contacts.

### `POST /identify`

This endpoint is used to identify a customer based on their email or phone number.

#### Request Body

The request body should be a JSON object containing either an `email`, a `phoneNumber`, or both.

```json
{
  "email": "mcfly@hillvalley.com",
  "phoneNumber": "123456"
}
```

#### Response Body

The response will be a JSON object containing the consolidated contact information.

- `primaryContactId`: The ID of the primary contact.
- `emails`: An array of all unique emails linked to the contact (primary first).
- `phoneNumbers`: An array of all unique phone numbers linked to the contact (primary first).
- `secondaryContactIds`: An array of IDs of all secondary contacts.

**Example Response:**

```json
{
    "contact": {
        "primaryContactId": 1,
        "emails": ["lorraine@hillvalley.com", "mcfly@hillvalley.com"],
        "phoneNumbers": ["123456", "987654"],
        "secondaryContactIds": [23]
    }
}
```

## Testing the Endpoint

You can use `curl` or any API client like Postman or Insomnia to test the `/identify` endpoint.

### Example 1: Create a new Primary Contact

If the email or phone number is not found in the database, a new contact with `linkPrecedence` as "primary" is created.

**Request:**

```bash
curl -X POST http://localhost:3000/identify \
-H "Content-Type: application/json" \
-d '{
  "email": "lorraine@hillvalley.com",
  "phoneNumber": "123456"
}'
```

**Response:**

```json
{
    "contact": {
        "primaryContactId": 1,
        "emails": ["lorraine@hillvalley.com"],
        "phoneNumbers": ["123456"],
        "secondaryContactIds": []
    }
}
```

### Example 2: Create a Secondary Contact

If one of the identifiers (email or phone number) already exists, a new "secondary" contact is created and linked to the primary contact.

**Request:**

```bash
curl -X POST http://localhost:3000/identify \
-H "Content-Type: application/json" \
-d '{
  "email": "mcfly@hillvalley.com",
  "phoneNumber": "123456"
}'
```

**Response:**

```json
{
    "contact": {
        "primaryContactId": 1,
        "emails": ["lorraine@hillvalley.com", "mcfly@hillvalley.com"],
        "phoneNumbers": ["123456"],
        "secondaryContactIds": [2]
    }
}
```

### Example 3: Linking two Primary Contacts

If the request contains two identifiers that belong to two different primary contacts, one of them will be updated to be a "secondary" contact linked to the older primary contact.

**Initial State:**
- Contact 1: `email: "george@hillvalley.com"`, `phoneNumber: "111222"`, `linkPrecedence: "primary"`
- Contact 2: `email: "biffsucks@hillvalley.com"`, `phoneNumber: "333444"`, `linkPrecedence: "primary"`

**Request:**

```bash
curl -X POST http://localhost:3000/identify \
-H "Content-Type: application/json" \
-d '{
  "email": "george@hillvalley.com",
  "phoneNumber": "333444"
}'
```

**Response:**
Assuming Contact 1 is older than Contact 2.

```json
{
    "contact": {
        "primaryContactId": 1,
        "emails": ["george@hillvalley.com", "biffsucks@hillvalley.com"],
        "phoneNumbers": ["111222", "333444"],
        "secondaryContactIds": [2]
    }
}
```

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma       # Prisma schema for the database
│   └── migrations/         # Database migration files
├── src/
│   ├── controllers/        # Express controllers for handling requests
│   ├── services/           # Business logic for identity reconciliation
│   ├── db/                 # Prisma client initialization
│   └── index.ts            # Main application entry point
├── docker-compose.yml      # Docker Compose for PostgreSQL
├── package.json
└── tsconfig.json
```

## Database Schema

The database schema is defined in `prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Contact {
  id             Int       @id @default(autoincrement())
  phoneNumber    String?
  email          String?
  linkedId       Int?
  linkPrecedence String    @default("primary") // "primary" or "secondary"
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?
}
```
