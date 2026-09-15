# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Google sign in

Add these values to `.env` (see `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

In Supabase, enable Google under Authentication > Providers and add
`http://localhost:5173/login` as a redirect URL. Add the production `/login`
URL there too when deploying.

## Account-backed kitchen items

Run the SQL in `supabase/schema.sql` in the Supabase SQL Editor. It creates the
`kitchen_items` table and row-level security policies so each Google account
can only read and change its own items. Inventory is no longer stored in
browser `localStorage`.

For AI recipes, add `VITE_OPENROUTER_API_KEY` to local `.env` and Netlify's
environment variables, then redeploy. The app also supports the numbered
`VITE_OPENROUTER_KEY_1`, `VITE_OPENROUTER_KEY_2`, and `VITE_OPENROUTER_KEY_3`
variables for key rotation. Never commit these keys to the repository.

## Web push notifications

This app uses Firebase Cloud Messaging (FCM) for browser push notifications.
It can show an expiry reminder while the site is closed, but only after the
user grants notification permission, signs in, and visits the site at least
once on that browser. Local mode cannot receive server-triggered reminders
because its inventory exists only in that browser.

### One-time Firebase setup

1. Create a Firebase project and add a Web app in Firebase Console.
2. Enable Cloud Messaging and create a Web Push certificate key under Project
	settings > Cloud Messaging.
3. Copy the Web app values and VAPID key into `.env` using the Firebase names
	in `.env.example`.
4. Copy the same public web-app values into
	`public/firebase-messaging-sw.js`. The service worker must be served from
	the site root.
5. Run the SQL in `supabase/schema.sql` again. It adds the
	`push_subscriptions` table that stores one FCM token per browser.
6. Deploy over HTTPS. `localhost` works for development, but ordinary HTTP
	production hosting will not allow browser push.

The Settings page now has an Enable button. It requests permission, registers
the service worker, obtains the FCM token, and saves it to Supabase. The
browser client must never contain Firebase Admin credentials.

### Sending reminders

FCM does not schedule expiry reminders by itself. Add a trusted scheduled job,
such as a Supabase Edge Function invoked daily by a scheduler or an external
cron service. That job should:

The repository includes `supabase/functions/send-expiry-reminders/index.ts`.
From a machine with the Supabase CLI installed and the project linked, run:

```bash
supabase link --project-ref <your-project-ref>
supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON='<full Firebase service-account JSON>'
supabase secrets set REMINDER_FUNCTION_SECRET='<long random value>'
supabase secrets set EXPIRY_REMINDER_DAYS='2'
supabase functions deploy send-expiry-reminders
```

The function queries `kitchen_items` for the configured reminder date, reads
the user's rows from `push_subscriptions`, sends through Firebase FCM HTTP v1,
records successful sends in `push_notification_log`, and removes invalid
tokens. Run the SQL in `supabase/schema.sql` before deploying it.

The current Settings preferences are local browser settings. The scheduled
function therefore honors whether a browser has a registered push token, but
does not yet read `notificationsEnabled` or `expiringReminders` while the app
is closed. Making those toggles server-controlled requires moving them into a
Supabase user-preferences table.

To invoke it daily, enable `pg_cron` and `pg_net` in Supabase, then run this
SQL with your project URL and the same function secret:

```sql
select cron.schedule(
	'daily-expiry-reminders',
	'0 9 * * *',
	$$
	select net.http_post(
		url := 'https://<project-ref>.supabase.co/functions/v1/send-expiry-reminders',
		headers := jsonb_build_object(
			'Content-Type', 'application/json',
			'Authorization', 'Bearer <REMINDER_FUNCTION_SECRET>'
		),
		body := '{}'::jsonb
	);
	$$
);
```

This server step is what makes notifications arrive when the app is closed.
For a managed alternative with scheduling and dashboards, OneSignal is easier
to operate; Firebase plus a Supabase Edge Function gives more control and
keeps the existing backend in one place.
