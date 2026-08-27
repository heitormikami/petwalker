# 🐾 Petwalker PWA — Novidades da Versão (What's New)

Bem-vinda à nova versão do **Petwalker**! Esta atualização traz um conjunto completo de melhorias de usabilidade, alertas inteligentes de tempo, proteção contra desligamento do celular, fotos em alta qualidade e sincronização automática.

---

## 🌟 Principais Destaques

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔔 Alertas de Tempo    🚗 Odômetro (Km)      🛡️ Anti-Crash no Cronômetro    │
│ 📸 Fotos dos Pets      ⏱️ Duração Fixa Auto  ☁️ Auto-Backup no Wi-Fi       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🐕 1. Passeios & Rotina na Rua

### 🔔 Alertas Sonoros e Notificações de Tempo
- **Aviso de 5 minutos antes**: Ao faltarem 5 minutos para o término do passeio (aos 25 min no plano de 30m ou aos 55 min no plano de 60m), o celular emite um **bip suave ascendente**, vibração dupla no bolso e notificação na tela:  
  *“⏰ Faltam 5 minutos! Prepare o retorno do passeio com [Pets].”*
- **Aviso de término exato**: Alerta sonoro comemorativo e notificação ao atingir o tempo contratado.
- **Cancelamento automático**: Se o passeio for finalizado antes, os alertas futuros são cancelados na hora.

### 🛡️ Proteção Anti-Crash (Imune a Reinicializações e Queda de Bateria)
- O cronômetro em andamento agora é salvo continuamente no armazenamento seguro do aparelho.
- Se o Safari recarregar a aba, a bateria do celular acabar ou o app for fechado acidentalmente durante a caminhada, **ao reabrir o app o cronômetro e os pets são restaurados exatamente de onde pararam**.

### ⏱️ Duração Contratada Inteligente
- Se o grupo de pets possuir apenas 1 plano de valor cadastrado (ex: apenas 30 min ou apenas 60 min), a tela do passeio já traz essa opção **preenchida e fixada automaticamente**, sem precisar selecionar nada manualmente.

### 🚗 Controle Opcional de Quilometragem (Carro)
- Novos campos opcionais de **Km Inicial** e **Km Final** ao concluir o passeio ou no lançamento manual.
- Exibição de badge com a distância calculada no Diário (ex: `🚗 Km: 12.450 → 12.465,5 (15.5 km)`).

### 📸 Registro Fotográfico com Compartilhamento e Exclusão
- Ao tocar na miniatura da foto no Diário, o modal de zoom em tela cheia agora possui:
  - **📤 Compartilhar**: Dispara a folha de compartilhamento nativa do celular (WhatsApp, Telegram, AirDrop, Salvar Imagem, etc.) com o arquivo da foto anexado.
  - **🗑️ Excluir Foto**: Permite apagar a foto do passeio com 1 clique se você não quiser mantê-la.
- Miniaturas com toque rápido para abrir o visualizador em tela cheia.

### 📅 Nova Barra de Navegação de Datas no Diário
- Barra de navegação espaçosa e destacada no topo do Diário:
  - Botões grandes e confortáveis ao toque: `◀ Ontem`, seletor de data centralizado, atalho `Hoje` e `Amanhã ▶`.

### 📱 Importação Direta de Contatos da Agenda
- Botão **"📱 Importar Contato"** no cadastro de Tutores, permitindo preencher Nome, Telefone e E-mail automaticamente através da agenda nativa do aparelho.

---

## 👥 2. Gestão de Tutores & Faturamento

### ✏️ Edição e Exclusão Estável de Tutores
- Gerenciamento com botões dedicados no rodapé dos cards.
- **Exclusão em cascata segura**: ao excluir um tutor, todos os seus grupos e pets associados são removidos de forma limpa do banco de dados local.

### 📱 Envio de Faturas via WhatsApp sem Erro de DDI (+55)
- O link do WhatsApp normaliza telefones com ou sem máscara e impede a duplicação do código do Brasil (`5555...`).

---

## 🔒 3. Segurança & Privacidade

### 🔑 Indicador de Status do PIN em Ajustes
- A aba **Ajustes ⚙️** agora exibe claramente se há uma senha ativa com a tag **`🔒 PIN Ativo`**, placeholder explicativo e um botão **Remover PIN** com 1 clique.
- Teclado numérico nativo abre automaticamente no iPhone ao digitar o PIN.

### 🔐 Criptografia Universal (SHA-256)
- Implementado algoritmo criptográfico universal que garante o funcionamento do PIN em qualquer ambiente (celular, computador ou rede local).

### 👆 Bloqueio Exclusivo por Biometria
- Suporte para bloquear o app apenas com FaceID / TouchID / Digital, mesmo que não haja PIN numérico cadastrado.

### 🆘 Recuperação de PIN Direto no Celular
- Botão *"Esqueceu o PIN?"* na tela de bloqueio com confirmação de segurança (digitando `REDEFINIR`), liberando o acesso sem apagar nenhum dado de passeios ou tutores.

---

## ☁️ 4. Sincronização Inteligente & Nuvem

### 📡 Auto-Backup Inteligente (Wi-Fi + Alterações Pendentes)
- O app monitora alterações locais (`pendingSync`) e envia o snapshot para o Google Drive automaticamente ao detectar conexão Wi-Fi ou ao reabrir o app em casa.
- Não consome seu plano de dados 4G/5G na rua.

### 🗄️ Política de Retenção no Google Drive
- O script atualizado do Google Apps Script gerencia os backups na nuvem:
  - **Últimos 20 dias**: Mantém 100% dos snapshots granulares.
  - **Entre 21 dias e 1 ano**: Preserva o último backup consolidado de cada mês.
  - **Mais de 1 ano**: Limpeza automática para economizar espaço no Drive.

---

## 🎨 5. Visual & PWA

- **Ícones em Alta Definição**: Ícones modernos desenhados especificamente para a tela inicial do iOS (Apple Touch Icon 180x180 sem cortes) e Android Adaptive Maskable.
- **Service Worker `v12`**: Atualização transparente em segundo plano mantendo todos os dados do banco local (`IndexedDB`) 100% intactos.

---

*Petwalker PWA — Cuidado profissional com tecnologia e carinho para os pets! 🐾*
