# A N B Haven Ventures Inventory

A local-first inventory and point-of-sale application for A N B Haven Ventures.

## Run locally

1. Install dependencies with `npm install`.
2. Start the development server with `npm run dev`.
3. Open the URL Vite prints in the terminal.

## Local data

All inventory, customers, sales, and settings currently live in this browser's `localStorage`. This lets the project work without any hosted service or environment variables.

The initial owner sign-in is `owner` with password `change-me`. Sign in once, then use Team to set a new owner password and create employee usernames and passwords. Employees can request a forgotten-password reset from the sign-in page; the owner approves it in Team.

Use one browser profile for a single shop/device. Clearing browser site data will remove the records. Before moving to another computer or using multiple cashiers at once, add an export/import feature or a shared backend.

## Checks

Run `npm run lint`, `npm run typecheck`, and `npm run build` before committing.
