# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Medventory-HMU is a medical inventory management system for a hospital unit (HMU). The backend is a Spring Boot 3.2.0 REST API serving a React/Vite frontend.

## Commands

```bash
# Run the application
./mvnw spring-boot:run

# Build
./mvnw clean package

# Run tests
./mvnw test

# Run a single test class
./mvnw test -Dtest=ClassName

# Skip tests during build
./mvnw clean package -DskipTests
```

The server starts on `http://localhost:8080`. The frontend dev server runs on `http://localhost:5173`.

**Prerequisites:** PostgreSQL running locally on port 5432 with database `medventory_hmu`, user `postgres`, password `admin123`.

## Architecture

**Stack:** Spring Boot 3.2.0 · Spring Data JPA (Hibernate) · PostgreSQL · Lombok

**Package root:** `com.backend`

**Layered structure:** Controller → Service → Repository → Entity

```
src/main/java/com/backend/
├── config/          # CORS config (allows localhost:5173)
├── controller/      # 11 REST controllers
├── service/         # 10 business services
├── entity/          # 26 JPA entities
├── repository/      # 26 Spring Data JPA repositories
└── dto/             # 51 request/response DTOs
```

Schema is auto-updated on startup (`spring.jpa.hibernate.ddl-auto=update`).

## API Design

All routes are prefixed `/api/`. Authentication is header-based — requests pass `X-User-Id: {userId}` rather than a Bearer token. The login endpoint returns a simple `user-token-{userId}` string (in-memory, non-persistent).

Key controller-to-path mappings:
- `AuthController` → `/api/auth` — login, register, password reset, permissions
- `AdminController` → `/api/admin` — user approval and role management
- `MaterialController` → `/api/materials` — inventory items
- `IssueReqController` → `/api/issue-requests` — request approval workflow
- `IssueController` → `/api/issues` — finalized issues
- `ReceiptController` → `/api/receipts` — material receipts
- `SuppForecastController` → `/api/supp-forecasts` — supply forecasting
- `NotificationController` → `/api/notifications`
- `DepartmentController` → `/api/departments`
- `InventorySummaryController` → `/api/inventory-summary`

## Domain Model

**Roles (Vietnamese):** `BGH` (Ban Giám Hiệu / leadership), `LANH_DAO` (department leader), `THU_KHO` (warehouse keeper), `CAN_BO` (staff)

**User lifecycle:** Register → `PENDING` → Admin approves → `APPROVED`. BGH users skip approval.

**Issue request workflow:** CAN_BO creates request → LANH_DAO approves → THU_KHO creates the actual issue and tracks inventory.

**RBAC model:** Default role permissions are hardcoded in `RbacService.DEFAULT_ROLE_PERMS`. Individual users can have overrides in the `user_permissions` table (grant or revoke). Permission codes follow the pattern `DOMAIN.ACTION` (e.g., `ISSUE_REQ.CREATE`, `RECEIPT.CREATE`, `USERS.MANAGE`).

**Inventory tracking:** Materials are classified A/B/C/D. Stock is tracked via `InventoryCard` with lot numbers. `IssueReservation` tracks pending stock commitments.

## Known Issues / Design Decisions

- Passwords are stored in **plaintext** — no hashing. Do not add BCrypt without a migration plan for existing rows.
- Auth tokens are stored **in-memory** in `AuthController` — they are lost on server restart. This is intentional for the current scope; do not silently change the auth model.
- `X-User-Id` header is the sole authentication mechanism for most endpoints — there is no Spring Security filter chain.
