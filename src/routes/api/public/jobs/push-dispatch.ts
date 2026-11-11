import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

/**
 * Sends pending LIVREI notifications (Match Direto, Desapego, chat, alerta Uber)
 * as push through OneSignal. Called by a schedule; rows are created by database triggers.
 */
export const Route = createFileRoute('/api/public/jobs/push-dispatch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const appId = process.env['ONESIGNAL_APP_ID'];
        const restKey = process.env['ONESIGNAL_REST_API_KEY'];
        if (!appId || !restKey) {
          return Response.json({ sent: 0, skipped: 'push_not_configured' });
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: pending, error } = await supabaseAdmin
          .from('notifications')
          .select('id, user_id, kind, title, body, data')
          .is('push_sent_at', null)
          .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .order('created_at')
          .limit(100);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let sent = 0;
        const failures: string[] = [];
        for (const n of pending ?? []) {
          const res = await fetch('https://api.onesignal.com/notifications?c=push', {
            method: 'POST',
            headers: { Authorization: `Key ${restKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app_id: appId,
              target_channel: 'push',
              include_aliases: { external_id: [n.user_id] },
              headings: { pt: n.title, en: n.title },
              contents: { pt: n.body, en: n.body },
              data: { ...(n.data as Record<string, unknown>), kind: n.kind, notification_id: n.id },
              priority: n.kind === 'uber_urgente' ? 10 : 5,
            }),
          });
          if (!res.ok) {
            failures.push(`${n.id}: [${res.status}] ${await res.text()}`);
            if (res.status === 429 || res.status >= 500) break;
            continue;
          }
          await supabaseAdmin.from('notifications').update({ push_sent_at: new Date().toISOString() }).eq('id', n.id);
          sent++;
        }
        if (failures.length) console.error('OneSignal push failures', failures);
        return Response.json({ sent, failed: failures.length });
      },
    },
  },
});
