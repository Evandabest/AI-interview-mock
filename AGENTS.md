# Repository guide

## Scope and workflow

This guide covers application code, shared components, database access, scripts, tests, and project configuration.

- Read the relevant code before changing behavior. Treat the running implementation and tests as the current reference; `documentation.md` contains historical design notes.
- Keep changes focused on the requested task. Preserve unrelated work already in the working tree.
- Follow nearby conventions and prefer straightforward solutions over new frameworks or broad abstractions.
- Do not commit, push, or publish changes unless the user requests it.
- Keep generated files, local databases, uploaded images, credentials, and build artifacts out of Git.

## Architecture

BidBay is a Next.js 15 App Router application using React, TypeScript, Tailwind CSS, and a local SQLite database. It runs on Node.js 22 or newer with a writable filesystem.

| Location | Responsibility |
| --- | --- |
| `app/` | Pages, route handlers, layouts, and server actions |
| `app/layout.tsx` | Shared layout, fonts, and navigation |
| `app/globals.css`, `tailwind.config.ts` | Global styles, theme tokens, and Tailwind configuration |
| `components/navbar.tsx` | Shared navigation and account menu |
| `components/ui/` | Reusable UI primitives built with Radix and Tailwind |
| `hooks/` | Shared React hooks, including toast state |
| `lib/local/client.ts` | Browser client for local queries, authentication, and image uploads |
| `lib/local/types.ts` | Shared query, result, and user contracts |
| `lib/local/query.ts` | Query execution, allowed tables/columns, relations, serialization, and record permissions |
| `lib/local/database.ts` | SQLite connection, schema initialization, and indexes |
| `lib/local/auth.ts` | Passwords, session records, authentication, and account lifecycle |
| `lib/local/server.ts` | Server-side session and cookie helpers |
| `lib/local/origin.ts` | Request-origin validation |
| `app/api/local/` | Local authentication, query, and file endpoints |
| `app/api/smart-bid/` | Optional Gemini integration |
| `lib/utils.ts` | Shared utilities, including `cn()` for class names |
| `scripts/` | Local database setup and sample-data scripts |
| `tests/` | Node test-runner tests executed through `tsx` |
| `public/` | Static assets |

Most interactive pages use client components. Browser code calls `createClient()` from `lib/local/client.ts`; local API handlers access the database and session helpers on the server. Login uses server actions in `app/login/actions.ts`.

Keep SQLite, filesystem operations, password handling, and session tokens on the server. Routes using these capabilities require the Node.js runtime. Do not import server database modules into client components or reintroduce a hosted database dependency.

## Data conventions

- Money values represent cents. Convert dollar input at the boundary and format cents for display; avoid mixing units in calculations.
- Record IDs are UUID strings. Record timestamps and auction expiry values use ISO strings; session expiry uses epoch milliseconds.
- SQLite stores boolean values as integers. The query layer converts `suspended` and `warning` to booleans for callers.
- Preserve existing serialization contracts: listing `pictures` stays a JSON string, while the query layer decodes JSON comments and responses when applicable. Check the caller before changing a field's shape.
- Use bound SQL parameters for values. Validate dynamic table and column identifiers against allowed schema entries.
- Use `getDatabase()` for application database access. Keep schema changes explicit: `CREATE TABLE IF NOT EXISTS` does not update existing tables, so provide an upgrade path when changing persisted structure.
- Preserve relationships and historical records deliberately when changing account or record lifecycle behavior.
- Database files default to `data/bidbay.sqlite`; uploads default to `data/uploads`. Paths can be configured through `SQLITE_PATH` and `UPLOAD_DIR`.

## Coding practices

- Use TypeScript and the `@/` import alias. Prefer explicit domain types and `unknown` with narrowing over adding new `any` types.
- Keep React components focused. Extract shared behavior when it is reused, while leaving page-specific logic close to its page.
- Add `"use client"` only where browser APIs, event handlers, or client state are needed.
- Derive values from existing state where practical instead of duplicating them in state. Clean up subscriptions and timers, and prevent outdated async results from updating a changed or unmounted view.
- Fetch independent data concurrently when useful; avoid repeated requests for identical data within a flow.
- Handle loading, empty, success, and failure states. Do not silently discard API errors or expose raw stack traces to users.
- Validate request data and permissions on the server; navigation visibility is a UI concern rather than an authorization boundary.
- Reuse the session and origin helpers. Never log passwords, session tokens, or secret environment values, and never return password hashes to the browser.
- Keep comments focused on intent or constraints. Avoid narrating obvious code.
- Add dependencies only when existing project tools cannot reasonably address the requirement. Update `package-lock.json` alongside dependency changes.

## Design and UI practices

- Match the existing restrained layout, neutral colors, card surfaces, and spacing. Use theme tokens instead of introducing unrelated visual styles.
- Reuse `components/ui/` controls, existing button variants, Lucide icons, and `cn()` rather than recreating equivalent components.
- Keep pages responsive. Verify narrow screens, long titles, and forms with validation messages.
- Provide visible labels for inputs and accessible names for icon-only buttons. Preserve keyboard access, focus indicators, and the dialog/menu semantics supplied by Radix.
- Keep account-specific controls consistent with authentication state. Do not reintroduce profile-picture UI without a product requirement.
- Use clear product language. Keep implementation details out of customer-facing messages.

## Development and verification

Install dependencies with `npm install --legacy-peer-deps`. Copy `.env.example` to `.env.local` for optional configuration. The app works locally without a Gemini key; that key is only needed for AI suggestions.

`npm run dev` starts Next.js and runs a sample-data setup hook first. Check its effects before restarting a server when preserving local state matters. Avoid resetting someone else's data during verification.

- Run `npm run typecheck` for TypeScript changes.
- Run `npm test` for changes to data access, authentication, permissions, or domain behavior. Add focused regression coverage for meaningful fixes.
- Run `npm run build` for changes affecting routing, server/client boundaries, dependencies, or build configuration.
- For UI changes, verify the affected flow in a browser, including relevant loading and failure states.
- Keep database tests isolated with temporary files and explicit paths. Do not depend on personal local data, external services, or test execution order.
- Documentation-only changes normally need a diff/format review rather than application tests.
- Report the checks performed and any unresolved limitations. Distinguish existing behavior from newly introduced changes.
