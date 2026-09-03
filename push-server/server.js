import express from 'express';
import cors from 'cors';
import webpush from 'web-push';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Chaves VAPID (Defina via variáveis de ambiente no Docker / Portainer)
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@petwalker.app';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4n9-v1b-b3f2i7r5-SamplePrivateKeyForDemo-ReplaceWithYourOwn';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Memória de timers ativos por sessão (permite cancelamento se o passeio for concluído antes)
const activeSessionTimers = new Map();

// 1. Health check & Chave Pública VAPID
app.get(['/vapid-public-key', '/push/vapid-public-key'], (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.get(['/health', '/push/health', '/'], (req, res) => {
  res.json({ status: 'ok', activeSessions: activeSessionTimers.size, service: 'Petwalker Push Scheduler' });
});

// 2. Teste de Push (Imediato ou com atraso em segundos)
app.post(['/test', '/push/test'], (req, res) => {
  try {
    const { subscription, delaySeconds = 15, title, body, tag } = req.body;

    if (!subscription) {
      return res.status(400).json({ success: false, error: 'Subscription ausente.' });
    }

    const payload = JSON.stringify({
      title: title || '🔔 Teste Petwalker VPS!',
      body: body || 'Web Push entregue com sucesso pela sua VPS na tela bloqueada! 🐾',
      tag: tag || 'test-push',
      timestamp: Date.now()
    });

    if (delaySeconds > 0) {
      setTimeout(async () => {
        try {
          await webpush.sendNotification(subscription, payload);
          console.log(`[Test Push] Enviado após ${delaySeconds}s`);
        } catch (err) {
          console.error('[Test Push] Erro ao enviar:', err.message);
        }
      }, delaySeconds * 1000);

      return res.json({ success: true, message: `Teste agendado para daqui a ${delaySeconds}s via VPS!` });
    } else {
      webpush.sendNotification(subscription, payload)
        .then(() => res.json({ success: true, message: 'Push enviado imediatamente via VPS!' }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Agendar Marcos de Passeio (50%, 5min e término)
app.post(['/schedule', '/push/schedule'], (req, res) => {
  try {
    const { sessionId, subscription, alerts = [] } = req.body;

    if (!sessionId || !subscription) {
      return res.status(400).json({ success: false, error: 'Dados incompletos (sessionId ou subscription ausente).' });
    }

    // Cancela timers anteriores da mesma sessão se houver
    if (activeSessionTimers.has(sessionId)) {
      activeSessionTimers.get(sessionId).forEach(t => clearTimeout(t));
      activeSessionTimers.delete(sessionId);
    }

    const timerHandles = [];

    alerts.forEach((alert) => {
      const delayMs = (alert.delayMinutes || 1) * 60 * 1000;
      const payload = JSON.stringify({
        title: alert.title,
        body: alert.body,
        tag: alert.tag,
        sessionId,
        timestamp: Date.now()
      });

      const handle = setTimeout(async () => {
        try {
          await webpush.sendNotification(subscription, payload);
          console.log(`[Walk Push] Enviado ${alert.tag} para sessão ${sessionId}`);
        } catch (err) {
          console.error(`[Walk Push] Erro ao enviar ${alert.tag}:`, err.message);
        }
      }, delayMs);

      timerHandles.push(handle);
    });

    activeSessionTimers.set(sessionId, timerHandles);
    console.log(`[Schedule] Sessão ${sessionId} agendada com ${alerts.length} alertas.`);

    res.json({ success: true, message: 'Alertas agendados com sucesso na sua VPS!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Cancelar Pushes de um Passeio Concluído
app.post(['/cancel', '/push/cancel'], (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && activeSessionTimers.has(sessionId)) {
    activeSessionTimers.get(sessionId).forEach(t => clearTimeout(t));
    activeSessionTimers.delete(sessionId);
    console.log(`[Cancel] Alertas da sessão ${sessionId} cancelados.`);
  }
  res.json({ success: true, message: 'Agendamentos cancelados.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Petwalker Push Server rodando na porta ${PORT}`);
});
