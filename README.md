# CRM-IVTEX Backend

Express.js server initialized with TypeScript, nodemon, and live reloading.

## Project Structure

```text
├── dist/                # Compiled JavaScript output (generated on build)
├── src/
│   ├── config/          # Configurations (database, environment, etc.)
│   ├── controllers/     # Route handlers & request processing
│   ├── middleware/      # Express custom middlewares
│   ├── models/          # Mongoose data models & schemas
│   ├── routes/          # Express route definitions
│   ├── services/        # Business logic layer
│   ├── utils/           # Helper functions & common utilities
│   ├── validators/      # Request validation schemas & middleware
│   └── index.ts         # Server entry point
├── .dockerignore        # Docker context ignore patterns
├── .env                 # Environment variables (local)
├── .env.example         # Example environment template
├── .gitignore           # Git ignore configurations
├── docker-compose.yml   # Multi-container orchestration (App + MongoDB)
├── Dockerfile           # Multi-stage production Docker build
├── nodemon.json         # Nodemon configuration
├── package.json         # Project metadata and dependencies
└── tsconfig.json        # TypeScript compiler options
```

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Check `.env`:
```env
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/crm-ivtex
```

### 3. Available Scripts

- **Development mode (with auto-restart)**:
  ```bash
  npm run dev
  ```

- **Build for production**:
  ```bash
  npm run build
  ```

- **Seed Initial Admin & Generate Token**:
  ```bash
  npm run seed
  ```

- **Run compiled production build**:
  ```bash
  npm start
  ```

## API Endpoints

### System Endpoints
| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `GET` | `/` | Root status message | Public |
| `GET` | `/health` | Health check & DB connection status | Public |

### Auth Module
*Dual-token authentication: Short-lived Access Token + Long-lived Refresh Token with HTTP-only cookies.*

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `POST` | `/auth/register` | Register a user | Public (Executive) / Admin only (Any role) |
| `POST` | `/auth/login` | Login, set tokens & cookies | Public |
| `POST` | `/auth/refresh` | Issue a new access token | Public (refresh token in cookie or body) |
| `POST` | `/auth/logout` | Clear auth cookies & revoke refresh token | Logged in |
| `GET` | `/auth/me` | Current user profile | Logged in |
| `PATCH` | `/auth/me` | Update own profile (name, phone) | Logged in |
| `PATCH` | `/auth/change-password` | Change own password | Logged in |

### User Management Module
*Access Codes: **A** = Admin, **M** = Manager, **E** = Executive*

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `POST` | `/users` | Create user | **A** |
| `GET` | `/users` | List (search, role/status filter, sort, pagination) | **A** |
| `GET` | `/users/assignable` | Active executives for assignment dropdowns | **A, M** |
| `GET` | `/users/:id` | Get user by ID | **A** |
| `PUT` | `/users/:id` | Update user | **A** |
| `PATCH` | `/users/:id/status` | Activate or deactivate user | **A** |
| `DELETE` | `/users/:id` | Delete (blocked if user owns records / subordinates) | **A** |

### Leads Module
*Lead lifecycle, assignment, conversion, and audit timeline tracking.*

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `POST` | `/leads` | Create lead | **A, M, E** |
| `GET` | `/leads` | List with filters, search, date range | **A, M, E** |
| `GET` | `/leads/:id` | Get lead details | **A, M, E** |
| `PUT` | `/leads/:id` | Update lead details | **A, M, E** |
| `PATCH` | `/leads/:id/status` | Change status (transition rules) | **A, M, E** |
| `PATCH` | `/leads/:id/assign` | Assign or reassign (active executives only) | **A, M** |
| `POST` | `/leads/:id/convert` | Convert to customer and deal (transaction) | **A, M, E** |
| `POST` | `/leads/:id/notes` | Add a note activity | **A, M, E** |
| `GET` | `/leads/:id/activities` | Activities on this lead | **A, M, E** |
| `GET` | `/leads/:id/timeline` | Audit history timeline | **A, M, E** |
| `DELETE` | `/leads/:id` | Delete lead | **A** |

*Key Rules*:
- Only **qualified** leads can convert, and only once.
- Executives can only view and manage leads assigned to them.
- Every assignment, status change, and priority change records an audit timeline entry.

### Customers Module
*Client accounts converted from leads or created directly.*

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `POST` | `/customers` | Create customer directly | **A, M, E** |
| `GET` | `/customers` | List with filters, search, date range | **A, M, E** |
| `GET` | `/customers/:id` | Get customer with original lead info | **A, M, E** |
| `PUT` | `/customers/:id` | Update customer | **A, M, E** |
| `GET` | `/customers/:id/deals` | Deals of this customer | **A, M, E** |
| `GET` | `/customers/:id/activities` | Activities on this customer | **A, M, E** |
| `GET` | `/customers/:id/timeline` | Audit history timeline | **A, M, E** |
| `DELETE` | `/customers/:id` | Delete customer (blocked if open deals exist) | **A** |

### Deals Module
*Pipeline deals with revenue calculation and stage transition rules.*

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `POST` | `/deals` | Create deal | **A, M, E** |
| `GET` | `/deals` | List (stage, assignee, min/max value, closing date) | **A, M, E** |
| `GET` | `/deals/:id` | Get deal details | **A, M, E** |
| `PUT` | `/deals/:id` | Update deal details | **A, M, E** |
| `PATCH` | `/deals/:id/stage` | Move stage (lostReason required for Lost) | **A, M, E** |
| `PATCH` | `/deals/:id/assign` | Reassign deal | **A, M** |
| `GET` | `/deals/:id/activities` | Activities on this deal | **A, M, E** |
| `GET` | `/deals/:id/timeline` | Audit history timeline | **A, M, E** |
| `DELETE` | `/deals/:id` | Delete deal | **A** |

*Key Rules*:
- Deal `value` must be greater than 0, and `probability` must be 0 to 100.
- `expectedRevenue` is computed by the server as `value × (probability / 100)`.
- Won and Lost deals cannot move back to an active stage.
- Lost stage requires a mandatory `lostReason` and valid closing date.
- Reassigning requires Admin or Manager permissions (**A, M**).

## Data Models & Relationships

- **User (`src/models/user.model.ts`)**: Admins, Managers, Executives.
- **Lead (`src/models/lead.model.ts`)**: Potential clients with status, source, priority, assignment, and conversion tracking (`customerId`, `dealId`).
- **Customer (`src/models/customer.model.ts`)**: Qualified converted clients with address details, assignment, and status.
- **Deal (`src/models/deal.model.ts`)**: Sales pipeline deals tracking value, probability, auto-calculated expected revenue (`value * probability`), pipeline stages, and mandatory `lostReason` when lost.

### Entity Relationships
```text
LEADS |o--o| CUSTOMERS : "converts to"
LEADS |o--o| DEALS     : "originates"
CUSTOMERS ||--o{ DEALS : "has"

USERS ||--o{ LEADS     : "assigned"
USERS ||--o{ CUSTOMERS : "owns"
USERS ||--o{ DEALS     : "owns"
```

## Docker

### Build and Run with Docker Compose
```bash
docker compose up --build
```
Or run in detached mode:
```bash
docker compose up -d
```
Stop containers:
```bash
docker compose down
```

### Build and Run with Docker CLI directly
```bash
# Build the image
docker build -t crm-ivtex-app .

# Run the container
docker run -p 8000:8000 --env-file .env crm-ivtex-app
```
