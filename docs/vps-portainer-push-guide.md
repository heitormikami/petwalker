# Guia de Instalação do Push Scheduler na sua VPS (Portainer + Nginx)

Este guia mostra como subir o servidor de Web Push na sua própria VPS usando **Portainer (Docker)** e configurar o **Nginx** como Proxy Reverso com SSL (HTTPS).

---

## 🐳 Método 1: Pelo Portainer (Interface Gráfica)

1. Acesse o **Portainer** da sua VPS.
2. No menu lateral, clique em **Stacks** > **+ Add stack**.
3. Dê o nome da stack: `petwalker-push`.
4. No editor **Web editor**, cole o conteúdo abaixo:

```yaml
version: '3.8'

services:
  petwalker-push:
    image: node:20-alpine
    container_name: petwalker-push-server
    restart: always
    working_dir: /app
    command: sh -c "npm install cors express web-push && node server.js"
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - VAPID_SUBJECT=mailto:contato@petwalker.app
      - VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U
      - VAPID_PRIVATE_KEY=SUA_CHAVE_PRIVADA_VAPID_AQUI
    volumes:
      - /var/www/petwalker-push:/app
```

5. Clique no botão **Deploy the stack**.

> **Nota:** Certifique-se de que o arquivo [`server.js`](file:///c:/WorkHeitor/Prd/Programação/Petwalker/push-server/server.js) e [`package.json`](file:///c:/WorkHeitor/Prd/Programação/Petwalker/push-server/package.json) estejam na pasta `/var/www/petwalker-push` da VPS, ou use o Dockerfile pronto da pasta `push-server`.

---

## 🌐 Configuração do Nginx (Proxy Reverso com HTTPS)

O Web Push da Apple exige **HTTPS**. No Nginx da sua VPS, adicione a seguinte configuração de site (ex: `/etc/nginx/sites-available/push.seudominio.com`):

```nginx
server {
    server_name push.seudominio.com; # ou um subdomínio seu

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # SSL gerenciado pelo Certbot / Let's Encrypt
    listen 443 ssl;
    # ssl_certificate /etc/letsencrypt/live/push.seudominio.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/push.seudominio.com/privkey.pem;
}

server {
    listen 80;
    server_name push.seudominio.com;
    return 301 https://$host$request_uri;
}
```

Para ativar e gerar o certificado SSL:
```bash
sudo ln -s /etc/nginx/sites-available/push.seudominio.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d push.seudominio.com
```

---

## 📱 Conectando o Petwalker à sua VPS

1. Abra o **Petwalker** no seu iPhone.
2. Vá em **Configurações** > **🔔 Notificações & Web Push**.
3. No campo **`🌐 Servidor de Web Push Nativo (Opcional - APNs)`**, coloque o seu domínio:
   `https://push.seudominio.com`
4. Clique em **💾 Salvar Configurações**.
5. Toque em **`🔔 Testar & Ativar Alertas (Espera 15s)`** e bloqueie a tela do iPhone!
