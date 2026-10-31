# Miss Haru portal setup

The teacher document portal uses Supabase for authentication, a PostgreSQL document table, and private file storage. The existing Google Drive links on the home page are left untouched.

## 1. Create a Supabase project

1. Create a project at https://supabase.com/dashboard.
2. Open **Project Settings → API Keys**.
3. Copy the Project URL and the **publishable** key (or legacy anon key).
4. Edit the two placeholders in the repository's `supabase-config.js`.
5. Do not put a secret key or `service_role` key in any browser-side file.

## 2. Create the database and private storage bucket

1. Open **SQL Editor** in the Supabase dashboard.
2. Open `supabase/schema.sql` from this repository, copy its full contents, and run it once.
3. The script creates the profiles and documents tables, row-level security policies, and a private `teacher-submissions` bucket. PDF and DOCX files are limited to 20 MB.

Run this on a new/empty Supabase project. If you already created tables or policies manually, review the SQL before rerunning it.

## 3. Configure email authentication

1. In **Authentication → Providers**, enable Email/password sign-in.
2. In **Authentication → URL Configuration**, add your deployed site URL to the allowed redirect URLs. For GitHub Pages this is normally:
   `https://hira2003.github.io/Miss.Haru/**`
3. Also add your local development URL if you use one, for example `http://localhost:5500/**`.
4. Decide whether to require email confirmation. If enabled, teachers must confirm their email before signing in.

## 4. Make your account the administrator

1. Open the deployed site and register your own teacher account.
2. Confirm your email if confirmation is enabled.
3. Sign in once.
4. In Supabase **SQL Editor**, replace the email below with the exact email used for your account and run:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'YOUR_EMAIL@example.com'
);
```

Only do this for your own trusted account. New registrations automatically receive the teacher role.

## 5. Test the workflow

- Open **Document Library** and register a test teacher account.
- Submit a small PDF or DOCX (maximum 20 MB).
- The submitter sees the document as **pending**; anonymous visitors cannot see it.
- Sign in with your administrator account and open **Admin review**.
- Preview the submission, then approve it.
- Confirm it appears in the public library. PDF files open in the browser; DOCX files download.
- Reject another test submission and confirm it stays out of the public library.

## Security notes

- Uploaded files are stored in a private bucket. The app creates short-lived signed links (15 minutes) only for approved files or files the current teacher/admin is allowed to access.
- Database row-level security controls who can read, submit, and moderate records.
- The browser uses only the Supabase project URL and publishable/anon key. Never expose a Supabase secret or service-role key.
- Admin status is stored in the protected profile role. Do not add a public admin-registration option.
- Existing Google Drive exam links remain as they were.
