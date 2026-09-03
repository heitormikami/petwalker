/**
 * Petwalker PWA - Serviço de Web Push Nativo (Apple APNs / Web Push RFC 8030/8291/8292)
 */

// Converte chave pública VAPID base64url para Uint8Array exigido pelo PushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const DEFAULT_VAPID_PUBLIC_KEY = 'BB08dOw-TjOOFxr5oq20_LImZFLWm7CRBvoYYRrB05lHOG5jGEMafgm6ciXR9Wrp65guJWWOgia5aLQBFKvpCYs';

export const PushService = {
  /**
   * Verifica se o navegador suporta Web Push
   */
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  /**
   * Obtém a chave pública VAPID do servidor ou usa a padrão
   */
  async fetchVapidKey(serverUrl) {
    if (serverUrl) {
      try {
        const res = await fetch(`${serverUrl.replace(/\/$/, '')}/vapid-public-key`);
        if (res.ok) {
          const data = await res.json();
          if (data.publicKey) return data.publicKey;
        }
      } catch (e) {
        console.warn('Usando chave VAPID padrão:', e);
      }
    }
    return DEFAULT_VAPID_PUBLIC_KEY;
  },

  /**
   * Obtém a inscrição push atual ou cria uma nova com a chave VAPID
   */
  async getOrSubscribe(serverUrl = null, vapidPublicKey = null) {
    if (!this.isSupported()) {
      throw new Error('Web Push não é suportado neste navegador/dispositivo.');
    }

    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const activeKey = vapidPublicKey || (await this.fetchVapidKey(serverUrl));
      const convertedVapidKey = urlBase64ToUint8Array(activeKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    return subscription;
  },

  /**
   * Envia requisição para o servidor de Push agendado
   */
  async scheduleWalkAlertsOnServer(serverUrl, session, subscription) {
    if (!serverUrl || !subscription) return null;

    const durationMin = Number(session.contractedDuration || 60);
    const halfwayMin = Math.round(durationMin / 2);
    const warningMin = Math.max(halfwayMin + 1, durationMin - 5);
    const groupName = session.groupName || 'Pets';

    const payload = {
      action: 'schedule_walk',
      sessionId: session.id,
      subscription: subscription.toJSON ? subscription.toJSON() : subscription,
      startTime: session.startTime,
      durationMin,
      alerts: [
        {
          delayMinutes: halfwayMin,
          tag: 'walk-halfway',
          title: '🧭 Metade do Passeio!',
          body: `Você atingiu ${halfwayMin} min com ${groupName}. Hora da meia-volta! 🐾`
        },
        {
          delayMinutes: warningMin,
          tag: 'walk-warning',
          title: '⏰ Faltam 5 minutos!',
          body: `O passeio com ${groupName} encerra em 5 minutos. Prepare o retorno!`
        },
        {
          delayMinutes: durationMin,
          tag: 'walk-finish',
          title: '🏁 Tempo Concluído!',
          body: `Duração de ${durationMin} min com ${groupName} concluída. Hora de encerrar!`
        }
      ]
    };

    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro no servidor de push: ${errText || res.statusText}`);
    }

    return await res.json();
  },

  /**
   * Cancela os pushes agendados no servidor para o passeio atual
   */
  async cancelWalkAlertsOnServer(serverUrl, sessionId) {
    if (!serverUrl || !sessionId) return;
    try {
      await fetch(`${serverUrl.replace(/\/$/, '')}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
    } catch (e) {
      console.warn('Erro ao cancelar agendamento de push no servidor:', e);
    }
  },

  /**
   * Dispara um push de teste imediato ou com atraso em segundos
   */
  async sendTestPush(serverUrl, subscription, delaySeconds = 15) {
    if (!serverUrl || !subscription) {
      throw new Error('Servidor de push ou inscrição ausente.');
    }

    const payload = {
      action: 'test_push',
      subscription: subscription.toJSON ? subscription.toJSON() : subscription,
      delaySeconds,
      title: '🔔 Teste Web Push Petwalker!',
      body: 'Notificação recebida com sucesso pela Apple (APNs) na tela bloqueada! 🐾',
      tag: 'test-push'
    };

    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Falha no teste de push: ${errText || res.statusText}`);
    }

    return await res.json();
  }
};
