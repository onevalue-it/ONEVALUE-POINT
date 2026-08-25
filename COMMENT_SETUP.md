# Feed comments setup

The UI now supports comments on `/feed`, but the database table must exist first.

## Apply database migration

Run the SQL in:

`supabase/migrations/20260825_add_post_comments.sql`

Option A - Supabase Dashboard:
1. Open Supabase project -> SQL Editor.
2. Paste the migration SQL.
3. Click Run.

Option B - Supabase CLI (if this project is linked and you are authenticated):

```bash
supabase db push
```

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/feed`.

Comment behavior:
- Authenticated users can read comments.
- Authenticated users can add comments as themselves.
- Users can delete only their own comments.
- Maximum comment length: 1000 characters.
- UI supports Vietnamese and Japanese.
