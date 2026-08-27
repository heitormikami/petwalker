# Petwalker 🐾🚀

**Petwalker** é uma aplicação PWA moderna, *local-first* e *offline-first*, desenvolvida para gestão completa de passeios de cães, controle de quilometragem, histórico fotográfico, alertas de tempo e fechamento de faturas mensais.

---

## ✨ Funcionalidades Principais

### 🐕 Gestão Operacional de Passeios
- **Cronômetro ao Vivo com Proteção Anti-Crash**: Se o navegador recarregar ou a bateria acabar no meio da caminhada, o passeio ativo e o tempo decorrido são recuperados automaticamente via `localStorage`.
- **🔔 Alertas Sonoros e Notificações de Término**:
  - **Aviso de 5 minutos antes**: Dispara notificação, som suave ascendente e vibração dupla aos 25 min (plano 30m) ou 55 min (plano 60m).
  - **Aviso de término exato**: Alerta comemorativo ao atingir a duração contratada.
- **⏱️ Duração Contratada Inteligente**: Ajusta e fixa a duração automaticamente caso o grupo possua apenas 1 plano de horário cadastrado (ex: apenas 30m ou apenas 60m), dispensando seleções manuais.
- **Novo Componente de Foto (Ícone de Câmera & Feedback Visual)**: Substitui o botão cinza nativo por um cartão moderno com ícone de câmera, pré-visualização instantânea, botão de exclusão e suporte a compartilhamento nativo (WhatsApp, Telegram, AirDrop).
- **Quilometragem (Km Inicial e Final)**: Registro opcional de odômetro para passeios realizados com transporte de carro, exibindo a distância total calculada nos cards do diário.
- **Barra de Navegação de Datas no Diário (Pill Bar)**: Barra compacta em formato de cápsula fina com botões táteis circulares `[ ◀ ]`, data centralizada sem quebra de linhas, atalho `[ Hoje ]` e botão de avanço `[ ▶ ]`.

### 👥 Tutores, Grupos & Precificação
- Cadastro de Tutores com grupos de pets associados e botão de **importação direta de contatos** da agenda do celular.
- Tabela de preços flexível por sessão (30 min / 60 min) com congelamento histórico de custos para garantir que reajustes futuros não alterem faturas de meses anteriores.
- Delegação de eventos segura para edição e exclusão em cascata (remove tutores, grupos e pets órfãos).

### 💳 Faturas & Cobranças
- Apuração mensal automática por tutor com controle de ajustes (créditos, débitos extras, descontos).
- Envio instantâneo de resumo por **WhatsApp** com tratamento de números nacionais e DDI `+55`.
- Disparo de fatura em HTML estilizado via **Google Apps Script (Gmail)** ou link direto no Webmail.

### 🔒 Segurança & Privacidade
- Bloqueio por **PIN numérico (4 dígitos)** com teclado virtual, botão de mostrar/ocultar (👁️), status visual em Ajustes, botão de remoção e feedback tátil de vibração *haptic* em dispositivos móveis.
- **Criptografia Universal**: Hash SHA-256 com fallback puro em JavaScript para compatibilidade total em qualquer navegador e ambiente (HTTP/HTTPS/iOS).
- Autenticação biométrica nativa (**FaceID / TouchID / Impressão Digital**) via WebAuthn.
- Modal de recuperação de emergência no próprio dispositivo em caso de esquecimento de PIN.

### ☁️ Sincronização Inteligente & Backup no Google Drive
- **Detecção de Conexão Wi-Fi**: Sincroniza em segundo plano ao conectar em redes Wi-Fi ou restaurar o foco do app, evitando consumo desnecessário do plano de dados 4G/5G.
- **Dirty Checking (Alterações Pendentes)**: Só realiza uploads quando houver dados realmente modificados ou novos.
- **Política de Retenção Automática no Google Drive**:
  - Últimos 20 dias: Mantém todos os snapshots diários e granulares.
  - Entre 21 e 365 dias: Preserva o último backup consolidado de cada mês.
  - Mais de 1 ano: Limpeza automática para economizar espaço.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend Core**: Vanilla HTML5, Modern CSS (Design System com temas Claro/Escuro, HSL e Variáveis CSS) e Vanilla JavaScript (ES Modules).
- **Armazenamento**: IndexedDB local-first (`StorageService`).
- **Segurança**: Web Crypto API + Pure JS SHA-256 Fallback e WebAuthn.
- **PWA**: Service Worker (`sw.js`) com cache `petwalker-v16` para execução 100% offline e notificações.
- **Cloud Backend**: Google Apps Script (Drive API + Gmail API).

---

## 📋 Regra Obrigatória do Processo de Desenvolvimento

> [!IMPORTANT]
> **Antes de qualquer `git commit` ou `git push` para o GitHub**, é obrigatório atualizar e sincronizar toda a documentação pendente:
> 1. `WHATS_NEW.md` (Notas da versão para o usuário final).
> 2. `README.md` (Visão geral e tecnologias).
> 3. `CONTEXT.md` (Regras de domínio e arquitetura).

---

## 🧪 Testes Automatizados Ultrarrápidos

O projeto conta com uma suíte de testes de domínio nativa sem dependências pesadas, executando em **~10ms**:

```bash
# Executa todos os testes de domínio e cálculos
node tests/domain.test.js
```

---

## 🚀 Como Executar Localmente

```bash
# Inicie um servidor web local simples (ex: Python)
python -m http.server 8081
```

Acesse no navegador: `http://localhost:8081` (ou instale como PWA na tela inicial do celular).

---

## 📄 Documentação Adicional
- [Guia do Google Apps Script & Retenção](docs/google-apps-script-guide.md)
- [Glossário de Domínio](CONTEXT.md)
- [Decisão de Arquitetura Local-First](docs/adr/0001-local-first-pwa-with-google-apps-script.md)
