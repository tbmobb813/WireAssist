---
name: safe-db-edit
description: Safely edit or delete rows in WireAssist's live production SQLite database on the VPS. Use whenever a fix requires directly touching the running database (deduplicating memory rows, cleaning up stale approvals, correcting bad data) rather than going through an API.
---

WireAssist's production database (`/data/.wireassist/wireassist.db` inside
the `wireassist-command-center-1` container) is a named Docker volume, not
a host bind-mount — direct edits require a script run inside the
container. This is a genuinely destructive capability; the whole point of
this skill is to make that safe by construction, not to make it faster.

## The rule that matters most

**Never run a broad or pattern-based DELETE.** Every deletion targets
exact row ids, and every script prints each row's full content before
deleting it, so the exact thing being removed is visible and confirmable
first — never inferred from a WHERE clause alone.

## Steps

1. **Prefer the API over a raw script whenever one exists.** E.g.
   `DELETE /api/memory/:id` already exists for memory rows — a raw DB
   script is for the cases nothing else covers (approval-queue cleanup,
   one-off data corrections, schema-level fixes).
2. **Query first, read the result, confirm it's the right row(s)** before
   writing any deletion logic — via the API if there's a `GET` for it, or
   a read-only script if not.
3. **Write a small Node script locally** using `better-sqlite3`, scoped to
   exact ids:
   ```js
   const Database = require('better-sqlite3');
   const db = new Database('/data/.wireassist/wireassist.db');
   const row = db.prepare('SELECT * FROM <table> WHERE id = ?').get('<exact-id>');
   console.log(JSON.stringify(row, null, 2)); // print before touching anything
   // db.prepare('DELETE FROM <table> WHERE id = ?').run('<exact-id>');
   db.close();
   ```
4. **Copy the script to the VPS**, then into the container at
   `/app/wireassist/core/` (required for `pnpm`'s node_modules resolution
   to find `better-sqlite3` — running it from elsewhere in the container
   will fail to resolve the module):
   ```bash
   scp -i ~/.ssh/claude_vps_key -o IdentityAgent=none -o IdentitiesOnly=yes \
     -o BatchMode=yes -o ConnectTimeout=8 \
     ./script.js jason@<vps-host>:/tmp/script.js
   ssh -i ~/.ssh/claude_vps_key -o IdentityAgent=none -o IdentitiesOnly=yes \
     -o BatchMode=yes -o ConnectTimeout=8 jason@<vps-host> \
     "docker cp /tmp/script.js wireassist-command-center-1:/app/wireassist/core/script.js && \
      docker exec -w /app/wireassist/core wireassist-command-center-1 node script.js"
   ```
5. **Run it once with the delete line commented out first**, read the
   printed row, confirm it's exactly the row intended — only then
   uncomment the delete and run again.
6. **Clean up the script from all three places** — inside the container,
   `/tmp` on the VPS, and the local machine — once done.

## Don't

- Don't write a DELETE with a `LIKE`, a tag match, or any condition
  broader than an exact id.
- Don't skip the print-before-delete step even for something that looks
  obviously safe (a "test" row, an "obviously stale" approval) — confirm
  by reading it, every time.
- Don't leave the script behind in the container or on the VPS after use.
