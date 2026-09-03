# Guia de Implantação: Servidor de Web Push Nativo (Apple APNs) - Petwalker

Este guia explica como implantar o **Push Scheduler (Cloudflare Worker)** 100% gratuito para que as notificações de 50%, 5 minutos e término toquem no iPhone mesmo com a tela bloqueada no bolso.

---

## ⚡ Passo 1: Instalar dependências e Gerar Chaves VAPID

Na pasta do projeto, abra o terminal e execute:

```bash
cd workers/push-scheduler
npm install
npx web-push generate-vapid-keys
```

Você receberá um par de chaves no terminal:
* **Public Key**: `BEl62iUY...`
* **Private Key**: `UUxI4n9...`

---

## ⚡ Passo 2: Configurar o `wrangler.toml`

Abra o arquivo [`workers/push-scheduler/wrangler.toml`](file:///c:/WorkHeitor/Prd/Programação/Petwalker/workers/push-scheduler/wrangler.toml) e cole as suas chaves geradas:

```toml
name = "petwalker-push-scheduler"
main = "worker.js"
compatibility_date = "2024-01-01"

[vars]
VAPID_SUBJECT = "mailto:seu-email@gmail.com"
VAPID_PUBLIC_KEY = "SUA_PUBLIC_KEY_AQUI"
VAPID_PRIVATE_KEY = "SUA_PRIVATE_KEY_AQUI"
```

---

## ⚡ Passo 3: Fazer o Deploy no Cloudflare Workers (Gratuito)

No terminal, execute:

```bash
npx wrangler deploy
```

O Cloudflare fornecerá uma URL pública como:
`https://petwalker-push-scheduler.seu-subdominio.workers.dev`

---

## ⚡ Passo 4: Conectar no Petwalker PWA

1. Abra o **Petwalker** no seu celular ou navegador.
2. Vá em **Configurações** > **🔔 Notificações & Web Push**.
3. No campo **`🌐 Servidor de Web Push Nativo (Opcional - APNs)`**, cole a URL do seu Worker:
   `https://petwalker-push-scheduler.seu-subdominio.workers.dev`
4. Clique em **💾 Salvar Configurações**.
5. Toque no botão **`🔔 Testar & Ativar Alertas (Espera 15s)`** e bloqueie a tela do iPhone para testar o recebimento direto via Apple APNs!
