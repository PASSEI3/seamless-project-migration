<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- The LIVREI app lives in `src/livrei/` and renders from the `/` route as one in-memory state machine (`LivreiApp.tsx`) with tabs kept mounted and overlays for flows — ported as-is from the Bolt prototype so screen state survives tab switches.
- Signed-in readers get profile, shelf and wallet from Lovable Cloud (`src/livrei/lib/account.ts`); "Pular" keeps a device-only demo on the mock data in `src/livrei/data.ts`. Feed, matches UI and Pix are still mock until the feed shows real readers' books.
- Public profile data lives in `profiles`; CPF, phone and address live only in owner-only `user_private`. E-mail signup keeps those fields in localStorage until the first confirmed sign-in, because `signUp` has no session while the e-mail is unconfirmed and user metadata ends up in the JWT.
- Matches are created only by the mutual-like trigger on `book_likes`; fee flags are written only by the payment backend (service role) and `can_chat()` gates `chat_messages` RLS, so the chat lock can't be bypassed from the phone. PIN handoff (`confirm_handoff_pin`) and ratings (`rate_trade`) award XP in the database.
- Push: database triggers write `notifications` rows; `/api/public/jobs/push-dispatch` (cron-authenticated) sends them via OneSignal using `external_id = user id`, which `src/livrei/lib/push.ts` sets on sign-in. Without OneSignal secrets both sides no-op.
- ViaCEP runs from the browser (`src/livrei/lib/cep.ts`); the ISBN cascade (Google Books → BrasilAPI → Open Library) runs on the server via `isbn.functions.ts` so `GOOGLE_BOOKS_API_KEY` never reaches the phone, with a keyless browser fallback.
- Encontro Presencial suggestions are generated per reader city in `src/livrei/lib/meetup.ts` (generic public places + free text); no hardcoded address lists, because readers live all over Brazil.
- Coin, XP and wallet rules are computed in database functions (`register_book`, `book_coin_value`, `award_xp`); clients never insert wallet/XP rows or edit `profiles.xp/status` — so balances can't be forged from the phone. `src/livrei/lib/economy.ts` mirrors them for the demo UI and must stay in sync.
- Book photos are compressed in the browser (`src/livrei/lib/imageCompression.ts`, max 1080px, WebP→JPEG fallback) before upload to the private `book-photos` bucket under `<user_id>/`; show them via signed URLs because the workspace blocks public buckets.
- Brand colors are Tailwind's purple scale plus custom `mint-*` tokens defined in `src/styles.css`; extend tokens there rather than adding hex colors in components.
