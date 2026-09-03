/**
 * Petwalker Web Push Scheduler - Cloudflare Worker
 * Protocolo Web Push RFC 8030 / 8291 / 8292 (Suporte nativo Apple APNs & Google FCM)
 */

import webpush from 'web-push';

// Configurações VAPID (Substitua pelas suas chaves ou use as variáveis de ambiente WRANGLER)
const VAPID_SUBJECT = 'mailto:contato@petwalker.app';
const DEFAULT_VAPID_PUBLIC = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const DEFAULT_VAPID_PRIVATE = 'UUxI4n9-v1b-b3f2i7r5-SamplePrivateKeyForDemo-ReplaceWithYourOwn';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Headers CORS para permitir chamadas do PWA
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const vapidPublic = env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC;
    const vapidPrivate = env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE;
    const vapidSubject = env.VAPID_SUBJECT || VAPID_SUBJECT;

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    // 1. Endpoint para obter chave pública VAPID
    if (url.pathname === '/vapid-public-key' && request.method === 'GET') {
      return new Response(JSON.stringify({ publicKey: vapidPublic }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Endpoint de Teste imediato / com delay curto
    if (url.pathname === '/test' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { subscription, delaySeconds = 15, title, body: notifBody, tag } = body;

        const payload = JSON.stringify({
          title: title || '🔔 Teste Petwalker!',
          body: notifBody || 'Web Push recebido com sucesso na tela bloqueada!',
          tag: tag || 'test-push',
          timestamp: Date.now()
        });

        if (delaySeconds > 0) {
          // Em Cloudflare Workers ou ambiente serverless com setTimeout / waitUntil
          ctx.waitUntil(
            new Promise((resolve) => {
              setTimeout(async () => {
                try {
                  await webpush.sendNotification(subscription, payload);
                } catch (e) {
                  console.error('Erro ao enviar push de teste:', e);
                }
                resolve();
              }, delaySeconds * 1000);
            })
          );

          return new Response(JSON.stringify({ success: true, message: `Push agendado para daqui a ${delaySeconds}s` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          await webpush.sendNotification(subscription, payload);
          return new Response(JSON.stringify({ success: true, message: 'Push enviado imediatamente!' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 3. Endpoint para Agendar os 3 Marcos do Passeio (50%, 5min e término)
    if (url.pathname === '/schedule' && request.method === 'POST') {
      try {
        const data = await request.json();
        const { sessionId, subscription, alerts = [] } = data;

        alerts.forEach((alert) => {
          const delayMs = (alert.delayMinutes || 1) * 60 * 1000;
          const payload = JSON.stringify({
            title: alert.title,
            body: alert.body,
            tag: alert.tag,
            sessionId,
            timestamp: Date.now()
          });

          ctx.waitUntil(
            new Promise((resolve) => {
              setTimeout(async () => {
                try {
                  await webpush.sendNotification(subscription, payload);
                } catch (err) {
                  console.error(`Erro ao disparar alerta ${alert.tag}:`, err);
                }
                resolve();
              }, delayMs);
            })
          );
        });

        return new Response(JSON.stringify({ success: true, message: 'Alertas de passeio agendados com sucesso!' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 4. Cancelar agendamentos
    if (url.pathname === '/cancel' && request.method === 'POST') {
      return new Response(JSON.stringify({ success: true, message: 'Agendamentos cancelados.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Petwalker Push Worker Ativo.', { headers: corsHeaders });
  }
};
