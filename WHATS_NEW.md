# 🐾 Petwalker PWA — Novidades da Versão (What's New)

Bem-vinda à nova versão do **Petwalker**! Esta atualização traz um conjunto completo de melhorias de usabilidade, alertas inteligentes de tempo, proteção contra desligamento do celular, fotos em alta qualidade e sincronização automática.

---

## 🌟 Principais Destaques

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔔 Alertas de Tempo    🚗 Odômetro (Km)      🛡️ Anti-Crash no Cronômetro    │
│ 📸 Cartão de Foto 3D   ⏱️ Duração Fixa Auto  ☁️ Auto-Backup no Wi-Fi       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🐕 1. Passeios & Rotina na Rua

### 🔔 Alertas Sonoros e Notificações de Tempo (v2.2.0 - Reforço Total)
- **Aviso de 5 minutos antes**: Ao faltarem 5 minutos para o término do passeio (aos 25 min no plano de 30m ou aos 55 min no plano de 60m), o celular emite um **bip suave ascendente**, vibração dupla no bolso, notificação do sistema na tela de bloqueio e banner visual pulsante no app:  
  *“⏰ Faltam 5 minutos! Prepare o retorno do passeio com [Pets].”*
- **Aviso de término exato**: Alerta sonoro comemorativo, vibração tripla, notificação na tela e banner visual verde ao atingir a duração contratada.
- **Checagem Retroativa (*Catch-up*)**: Se o celular suspender o navegador durante o bloqueio de tela, assim que a passeadora tocar na tela ou abrir o app, o sistema detecta o marco instantaneamente e dispara o alerta na hora.
- **Disparo Seguro via Service Worker**: Notificações otimizadas para Android e iOS PWA com persistência na tela (`requireInteraction: true`).
- **📱 Manter Tela Acesa (*Screen Wake Lock*)**: Opção nas configurações para impedir que a tela bloqueie sozinha enquanto o cronômetro do passeio estiver em andamento.
- **Cancelamento automático**: Se o passeio for finalizado antes, os alertas futuros são cancelados na hora.

### 🛡️ Proteção Anti-Crash (Imune a Reinicializações e Queda de Bateria)
- O cronômetro em andamento agora é salvo continuamente no armazenamento seguro do aparelho.
- Se o Safari recarregar a aba, a bateria do celular acabar ou o app for fechado acidentalmente durante a caminhada, **ao reabrir o app o cronômetro e os pets são restaurados exatamente de onde pararam**.

### ⏱️ Duração Contratada Inteligente
- Se o grupo de pets possuir apenas 1 plano de valor cadastrado (ex: apenas 30 min ou apenas 60 min), a tela do passeio já traz essa opção **preenchida e fixada automaticamente**, sem precisar selecionar nada manualmente.

### 🚗 Controle Opcional de Quilometragem (Carro)
- Novos campos opcionais de **Km Inicial** e **Km Final** ao concluir o passeio ou no lançamento manual.
- Exibição de badge com a distância calculada no Diário (ex: `🚗 Km: 12.450 → 12.465,5 (15.5 km)`).

### 📸 Novo Componente de Foto (Ícone de Câmera & Feedback Visual)
- Substituído o botão cinza nativo do navegador por um cartão moderno:
  - 📸 **Ícone de câmera em destaque**.
  - **Título e Instrução**: *"Tirar / Anexar Foto • Toque para abrir a câmera ou galeria"*.
  - **Feedback Imediato**: Muda para `✅ Foto Anexada` com miniatura e botão `✕ Remover Foto`.
- **Compartilhamento & Exclusão no Zoom**:
  - **📤 Compartilhar**: Dispara o menu nativo do celular (WhatsApp, Telegram, AirDrop, etc.) enviando o arquivo da foto.
  - **🗑️ Excluir Foto**: Remove a foto daquele passeio com 1 toque.
  - **✖️ Fechar**: Botão no topo e no rodapé para fechar a visualização.

### 📅 Barra de Navegação de Datas Compacta (Pill Bar) & Correção de Fuso Horário
- Barra de navegação em formato de cápsula fina (*pill*) no topo do Diário:
  - Botões circulares limpos `[ ◀ ]` e `[ ▶ ]`.
  - Campo de data centralizado sem quebra de linhas.
  - Atalho rápido `[ Hoje ]` para retorno imediato ao dia atual.
- **Correção de Fuso Horário Noturno (Fim do bug das 21h/UTC)**:
  - Corrigido o cálculo de datas locais (`getLocalDateString`). Anteriormente, o uso de conversões em UTC adiantava a data para o dia seguinte a partir das 21h00 no horário de Brasília (UTC-3). Agora o app respeita estritamente o dia civil local em qualquer horário!

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

- **Novo Ícone Premium 3D (Opção 1)**: Cãozinho estilizado caminhando com coleira e pata luminosa em acabamento *glassmorphism* em alta resolução para iPhone e Android.
- **Versão Visível em Ajustes**: Rodapé com a versão oficial (`Petwalker PWA • Versão 2.1 (Build 2026.08)`).
- **Service Worker `v16`**: Atualização transparente em segundo plano mantendo todos os dados do banco local (`IndexedDB`) 100% intactos.

---

*Petwalker PWA — Cuidado profissional com tecnologia e carinho para os pets! 🐾*
