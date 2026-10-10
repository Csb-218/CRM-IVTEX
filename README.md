# CRM-IVTEX Backend

Enterprise B2B Customer Relationship Management (CRM) RESTful API backend built with Node.js, Express.js 5, TypeScript, and MongoDB.

---

## Table of Contents
- [1. Project Overview](#1-project-overview)
- [2. Technologies Used](#2-technologies-used)
- [3. Installation Steps](#3-installation-steps)
- [4. Environment Variables](#4-environment-variables)
- [5. Database Setup](#5-database-setup)
- [6. How to Run the Server](#6-how-to-run-the-server)
- [7. Authentication Mechanism](#7-authentication-mechanism)
- [8. User Roles and Permissions](#8-user-roles-and-permissions)
- [9. API Documentation](#9-api-documentation)
- [10. Important Business Rules](#10-important-business-rules)
- [11. Database and Indexing Decisions](#11-database-and-indexing-decisions)
- [12. Assumptions Made](#12-assumptions-made)

---

## 1. Project Overview

**CRM-IVTEX** is a robust, enterprise-grade backend service designed to power B2B sales cycles, pipeline management, client relations, and team productivity. It implements:

- **Identity & Access Management**: Dual-token JWT auth, password encryption, and role-based access control.
- **Lead Lifecycle Management**: Tracking leads from acquisition through qualification and atomic conversion into paying customers and pipeline deals.
- **Customer Accounts & Deal Pipelines**: Managing client records and probability-weighted revenue pipelines across standard sales stages.
- **Polymorphic Activities**: Scheduling and logging calls, meetings, emails, reminders, demos, notes, and tasks across leads, customers, deals, and users.
- **Audit Timeline Logs**: Immutable, append-only change logs capturing entity transitions, assignments, and key events.
- **Analytics & Reporting**: Real-time sales dashboards powered by native MongoDB aggregation pipelines (`$facet`, `$group`, `$lookup`).

---

## 2. Technologies Used

| Technology | Purpose | Version / Details |
|---|---|---|
| **Node.js** | JavaScript runtime environment | v18+ LTS |
| **Express.js** | HTTP web framework | 5.x |
| **TypeScript** | Static typing & developer ergonomics | 5.x |
| **MongoDB** | NoSQL document database | 7.x |
| **Mongoose** | Object Document Modeling (ODM) | 9.x |
| **JSON Web Tokens (`jsonwebtoken`)** | Stateless token-based authentication | Access & Refresh tokens |
| **Bcrypt.js (`bcryptjs`)** | One-way cryptographic password hashing | 10 salt rounds |
| **Cookie-Parser** | Secure HTTP-only cookie parsing | Client token storage |
| **CORS** | Cross-Origin Resource Sharing handling | Credentials enabled |
| **Docker & Docker Compose** | Multi-container application orchestration | Node app + MongoDB |
| **Nodemon & ts-node** | Hot-reloading development server | Real-time TS compilation |

---

## 3. Installation Steps

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Local MongoDB instance (port 27017) OR a MongoDB Atlas cluster URI OR Docker installed

### Setup
1. **Clone repository**:
   ```bash
   git clone https://github.com/Csb-218/CRM-IVTEX.git
   cd CRM-IVTEX
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

---

## 4. Environment Variables

Configure the following variables in your `.env` file:

| Variable | Description | Default / Example | Required |
|---|---|---|:---:|
| `PORT` | Port number for the HTTP server | `8000` | No |
| `NODE_ENV` | Application runtime environment (`development`, `production`, `test`) | `development` | Yes |
| `MONGODB_URI` | MongoDB connection connection string | `mongodb://127.0.0.1:27017/crm-ivtex` | Yes |
| `JWT_SECRET` | Secret key used for signing short-lived Access Tokens | `your_jwt_secret_key_here` | Yes |
| `JWT_EXPIRES_IN` | Access Token expiration duration | `15m` | Yes |
| `JWT_REFRESH_SECRET` | Secret key used for signing long-lived Refresh Tokens | `your_jwt_refresh_secret_key_here` | Yes |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token expiration duration | `7d` | Yes |
| `CLIENT_URL` | Allowed frontend URL for CORS origin validation | `http://localhost:3000` | No |

---

## 5. Database Setup

### 1. Connection
- **Local MongoDB**: Ensure `mongod` service is running on `mongodb://127.0.0.1:27017/crm-ivtex`.
- **MongoDB Atlas**: Replace `MONGODB_URI` in `.env` with your Atlas replica set connection string.
- **Docker Compose**: Uses service name `mongodb:27017` automatically.

### 2. Database Seeding
Populate all 6 collections (`users`, `leads`, `customers`, `deals`, `activities`, `timelines`) with initial valid, interconnected data:

```bash
npm run seed
```

This creates:
- **Admin**: `admin@ivtex.com` / `adminPassword123`
- **Manager**: `manager@ivtex.com` / `managerPassword123`
- **Executive**: `executive@ivtex.com` / `executivePassword123`
- Sample leads, customers, deals, polymorphic activities, and timeline logs.

---

## 6. How to Run the Server

### Option A: Local Development
```bash
# Starts nodemon with live reload on port 8000
npm run dev
```

### Option B: Production Build & Run
```bash
# 1. Compile TypeScript to JavaScript in /dist
npm run build

# 2. Run compiled production server
npm start
```

### Option C: Docker Compose (App + MongoDB)
```bash
# Build images and start both App & MongoDB containers
docker compose up --build

# Run in background (detached mode)
docker compose up -d

# Stop containers
docker compose down
```

---

## 7. Authentication Mechanism

CRM-IVTEX implements a **Dual-Token Authentication Architecture**:

1. **Short-Lived Access Token (15 Minutes)**:
   - Stateless JWT containing `{ id, role, email }`.
   - Used to authenticate all incoming API requests.
   - Sent via `Authorization: Bearer <token>` header OR HTTP-only `accessToken` cookie.
2. **Long-Lived Refresh Token (7 Days)**:
   - JWT containing `{ id }`.
   - Stored in database on the user document (`user.refreshToken`, hashed/hidden with `select: false`).
   - Stored on client in an HTTP-only, SameSite cookie (`refreshToken`).
   - Used exclusively at `POST /auth/refresh` to obtain new access tokens without re-entering credentials.
3. **Password Security**:
   - Encrypted using `bcryptjs` with 10 salt rounds via Mongoose `pre('save')` hooks.
   - Password hash is omitted by default from all queries (`select: false`).
4. **Token Revocation & Logout**:
   - `POST /auth/logout` clears both auth cookies and sets `user.refreshToken = null` in the database.
5. **Development Testing Shortcut**:
   - In non-production environments (`NODE_ENV !== 'production'`), requests can pass `x-user-id: <mongoUserId>` header to simulate authentication without obtaining a JWT token.

---

## 8. User Roles and Permissions

The system defines 3 hierarchical roles (`A` = Admin, `M` = Manager, `E` = Executive):

1. **Admin (`A`)**:
   - Full organization-wide access.
   - User creation, update, deactivation, and deletion.
   - Unrestricted CRUD across all leads, customers, deals, activities, and audit logs.
2. **Manager (`M`)**:
   - Supervises sales executives assigned to them via `managerId`.
   - Assigns and reassigns leads and deals.
   - Views team analytics, reports, and timeline audit logs.
3. **Executive (`E`)**:
   - Sales representative.
   - Strictly scoped: can only view and manage leads, customers, deals, and activities assigned to them.
   - Can convert leads and mark activities completed.
   - Restricted from reassigning records or viewing team/timeline management endpoints.

### Permissions Matrix

| Module / Operation | Admin (`A`) | Manager (`M`) | Executive (`E`) |
|---|:---:|:---:|:---:|
| User Management (`/users`) | Full CRUD | Assignable list only | ❌ |
| Create & View Leads | Full Org | Full Org / Team | Assigned only |
| Assign / Reassign Leads & Deals | ✅ | ✅ | ❌ |
| Convert Lead to Customer & Deal | ✅ | ✅ | Assigned only |
| Create & View Customers & Deals | Full Org | Full Org / Team | Assigned only |
| Move Deal Stage | ✅ | ✅ | Assigned only |
| Delete Leads, Customers, Deals | ✅ | ❌ | ❌ |
| Create, View, Complete Activities | ✅ | ✅ | Assigned / Created |
| Delete Activity | Any | Any | Created by self only |
| Query Timeline Logs (`/timeline`) | ✅ | ✅ | ❌ |
| Dashboard Summary & Pipeline | Full Org | Team scope | Assigned scope |
| Team Performance & Lead Sources | Full Org | Team scope | ❌ |

---

## 9. API Documentation

All routes are mounted at both `/` and `/api` (e.g., `/leads` and `/api/leads`).

### System
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/` | Root server status | Public |
| `GET` | `/health` | Server and database health check | Public |

### Auth Module
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/auth/register` | Register a new user | Public / Admin |
| `POST` | `/auth/login` | Login, sets HTTP-only cookies and tokens | Public |
| `POST` | `/auth/refresh` | Issue new access token using refresh token | Public |
| `POST` | `/auth/logout` | Revoke refresh token and clear cookies | Logged In |
| `GET` | `/auth/me` | Current authenticated user profile | Logged In |
| `PATCH` | `/auth/me` | Update personal profile details | Logged In |
| `PATCH` | `/auth/change-password` | Change password (verifies current password) | Logged In |

### User Management Module
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/users` | Create user with role & manager assignment | **A** |
| `GET` | `/users` | List users with search, role/status filter, pagination | **A** |
| `GET` | `/users/assignable` | List active executives for assignment dropdowns | **A, M** |
| `GET` | `/users/:id` | Get user details by ID | **A** |
| `PUT` | `/users/:id` | Update user details and roles | **A** |
| `PATCH` | `/users/:id/status` | Activate or deactivate user | **A** |
| `DELETE` | `/users/:id` | Delete user (blocked if owning records/subordinates) | **A** |

### Leads Module
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/leads` | Create a new lead | **A, M, E** |
| `GET` | `/leads` | List leads (search, status, source, priority, pagination) | **A, M, E** |
| `GET` | `/leads/:id` | Get lead details | **A, M, E** |
| `PUT` | `/leads/:id` | Update lead details | **A, M, E** |
| `PATCH` | `/leads/:id/status` | Change lead status (transition rules enforced) | **A, M, E** |
| `PATCH` | `/leads/:id/assign` | Assign or reassign lead to active executive | **A, M** |
| `POST` | `/leads/:id/convert` | Atomically convert lead to Customer + Deal | **A, M, E** |
| `POST` | `/leads/:id/notes` | Add a note activity on lead | **A, M, E** |
| `GET` | `/leads/:id/activities` | List all activities on this lead | **A, M, E** |
| `GET` | `/leads/:id/timeline` | Audit history timeline for this lead | **A, M, E** |
| `DELETE` | `/leads/:id` | Delete lead and cascade cleanup | **A** |

### Customers Module
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/customers` | Create customer directly | **A, M, E** |
| `GET` | `/customers` | List customers (search, status, date filter, pagination) | **A, M, E** |
| `GET` | `/customers/:id` | Get customer details with lead reference | **A, M, E** |
| `PUT` | `/customers/:id` | Update customer address and details | **A, M, E** |
| `GET` | `/customers/:id/deals` | List all deals associated with this customer | **A, M, E** |
| `GET` | `/customers/:id/activities` | List activities on this customer | **A, M, E** |
| `GET` | `/customers/:id/timeline` | Audit history timeline for this customer | **A, M, E** |
| `DELETE` | `/customers/:id` | Delete customer (blocked if open deals exist) | **A** |

### Deals Module
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/deals` | Create pipeline deal (validates customer and value > 0) | **A, M, E** |
| `GET` | `/deals` | List deals (stage, assignee, value range, close date) | **A, M, E** |
| `GET` | `/deals/:id` | Get deal details | **A, M, E** |
| `PUT` | `/deals/:id` | Update deal details and probability | **A, M, E** |
| `PATCH` | `/deals/:id/stage` | Move stage (`lostReason` required for Lost; Won/Lost immutable) | **A, M, E** |
| `PATCH` | `/deals/:id/assign` | Reassign deal to executive | **A, M** |
| `GET` | `/deals/:id/activities` | List activities on this deal | **A, M, E** |
| `GET` | `/deals/:id/timeline` | Audit history timeline for this deal | **A, M, E** |
| `DELETE` | `/deals/:id` | Delete deal | **A** |

### Activities Module
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/activities` | Create activity or follow-up (`call`, `meeting`, `demo`, `note`, etc.) | **A, M, E** |
| `GET` | `/activities` | List activities (type, status, overdue, assignee, due range) | **A, M, E** |
| `GET` | `/activities/:id` | Get activity by ID | **A, M, E** |
| `PUT` | `/activities/:id` | Update activity details, assignee, or due date | **A, M, E** |
| `PATCH` | `/activities/:id/complete` | Mark activity completed with timestamp & outcome notes | **A, M, E** |
| `DELETE` | `/activities/:id` | Delete activity (**A, M**, or user who created it) | **A, M, creator** |

### Timeline Module
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/timeline` | Query audit logs by entityType, entityId, action, date range | **A, M** |

### Dashboard Module (Aggregation Pipelines)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/dashboard/summary` | Lead, customer, deal, revenue, activity metrics & conversion rates | **A, M, E** |
| `GET` | `/dashboard/pipeline` | Deal count, total value, and expected revenue per stage | **A, M, E** |
| `GET` | `/dashboard/team-performance` | Per-executive leads, conversions, win rate, and revenue | **A, M** |
| `GET` | `/dashboard/lead-sources` | Lead count, conversion rate, and revenue by acquisition source | **A, M** |

---

## 10. Important Business Rules

1. **Lead Qualification & Atomic Conversion**:
   - Only leads in `qualified` status can be converted.
   - Conversion is executed inside a MongoDB session transaction, creating a `Customer` and a `Deal` simultaneously while updating the lead status to `converted`.
   - A converted lead cannot be converted a second time.
2. **Deal Pipeline Rules**:
   - Deal `value` must be strictly positive (`value > 0`).
   - Deal `probability` is clamped between `0` and `100`.
   - `expectedRevenue` is computed server-side: `value * (probability / 100)`.
   - Closed deals (`won` or `lost`) cannot be reopened or changed to active stages.
   - Moving a deal to `lost` strictly requires providing a `lostReason`.
3. **Data Scoping & Executive Isolation**:
   - Users with role `executive` can only access records assigned to them or created by them.
   - Global listings (`/leads`, `/customers`, `/deals`, `/activities`, `/dashboard`) automatically scope records for executives.
4. **Deletion Safety Guardrails**:
   - **Users**: Cannot be deleted if they currently own active leads, customers, deals, or supervise subordinates.
   - **Customers**: Cannot be deleted if they have active pipeline deals associated with them.
   - **Activities**: Can only be deleted by Admins, Managers, or the specific user who created the activity (`createdBy`).
5. **Polymorphic Activity Sync**:
   - Setting an activity status to `completed` auto-stamps `completedAt = new Date()`.
   - Activities of type `note` are marked `completed` immediately upon creation.

---

## 11. Database and Indexing Decisions

1. **Polymorphic Relationships**:
   - `activities` and `timelines` collections utilize a polymorphic pattern (`entityType`: `lead` \| `customer` \| `deal` \| `user` + `entityId`: `ObjectId`).
   - Enables centralized activity logs without duplicating activity collections per entity.
2. **Compound & Query Indexes**:
   - **Activities**:
     - `{ entityType: 1, entityId: 1, createdAt: -1 }`: Rapid entity activity feed queries.
     - `{ assignedTo: 1, status: 1, dueDate: 1 }`: Optimized for overdue activity alerts and executive agenda queries.
   - **Timelines**:
     - `{ entityType: 1, entityId: 1, createdAt: -1 }`: Fast audit history retrieval.
   - **Leads**:
     - `{ assignedTo: 1, status: 1 }`: Accelerated executive lead queue filtering.
     - `{ email: 1 }`: Index for search and uniqueness lookup.
   - **Customers**:
     - `{ email: 1 }` (unique): Prevents duplicate customer registration.
     - `{ assignedTo: 1 }`: Scoped executive listing index.
   - **Deals**:
     - `{ assignedTo: 1, stage: 1 }`: Fast pipeline status filtering.
     - `{ customerId: 1 }`, `{ leadId: 1 }`: Foreign key lookups.
3. **Append-Only Immutable Audit Log**:
   - `timelines` schema disables `updatedAt` (`timestamps: { createdAt: true, updatedAt: false }`), enforcing append-only tamper-resistant audit logs.
4. **Security Exclusions**:
   - `password` and `refreshToken` fields have `{ select: false }` to avoid accidental exposure in queries and logs.

---

## 12. Assumptions Made

1. **Single-Tenant Model**: The platform is built as an enterprise single-organization CRM where all users belong to the same company.
2. **Currency Uniformity**: All deal values and revenue calculations assume a single unified currency (USD) without real-time multi-currency FX conversions.
3. **Timezone Standardization**: All timestamps and date range queries (`startDate`, `endDate`, `timeframe`) are processed in ISO 8601 UTC.
4. **Transaction Environment**: Lead conversion utilizes MongoDB replica set sessions (`startSession()`); when running in standalone development instances without replica sets, it safely falls back to standard execution.
5. **Team Structure**: Managers supervise executives defined by the `managerId` foreign key on the `users` document. Administrators can view all teams and reassign hierarchy at any time.
