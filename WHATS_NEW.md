# 🐾 Petwalker PWA — Novidades da Versão (What's New)

Bem-vinda à nova versão do **Petwalker (v2.9.4 / Cache v36)**! Esta atualização traz o **redesign completo da tela de Ajustes no estilo nativo Apple iOS (Grouped Inset Cards)**, botão dedicado para cancelamento de passeios ativos com confirmação segura, alinhamento numérico à direita e padronização visual em todos os modais.

---

## 🌟 Principais Destaques (v2.9.4)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎨 Ajustes Apple Inset │ 🛑 Cancelar Passeio   │ 🐾 Cards Tutores Equilibrados│
│ 💬 WhatsApp Direto     │ 🔢 Valores Alinhados  │ 📱 Ergonomia iPhone XR       │
│ 💰 Totais Separados    │ 🛁 Gestão de Banhos   │ ☁️ Auto-Backup no Wi-Fi      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 1. Redesign da Tela de Ajustes (Estilo Nativo Apple iOS)

### 🗂️ 4 Cards Agrupados com Fundo Elevado e Cantos Arredondados
A tela de configurações foi reestruturada para eliminar o bloco longo de rolagem, dividindo as opções em 4 cartões distintos e confortáveis:
1. **🎨 Geral & Cobrança**: Seleção de Tema Visual (Sistema, Claro, Escuro), Chave PIX Padrão para faturas e botão direto `💾 Salvar Ajustes`.
2. **🔒 Segurança & Acesso**: Badge dinâmico de status do PIN (`🛡️ Protegido` ou `⚠️ Não cadastrado`), campo de 4 dígitos com botão de visibilidade `👁️`, botões `Salvar PIN` / `Remover PIN` e botão de biometria nativa (`WebAuthn`).
3. **🔔 Alertas & Passeio**: Toggle nativo iOS para manter tela acesa (*Wake Lock*), botão para testar alertas locais com espera de 15 segundos e detalhes colapsáveis `<details>` para configuração avançada do servidor Web Push (APNs).
4. **☁️ Nuvem & Backups**: Status em tempo real da sincronização, toggle de auto-backup inteligente em Wi-Fi, endpoint do Google Apps Script e botões de ação verticalizados (`☁️ Fazer Backup`, `🔄 Sincronizar da Nuvem`, `📥 Exportar JSON`).
5. **Rodapé de Versão**: Versão do App (`2.9.4`) e Build (`2026.09.07 - v36`) centralizados.

---

## 🛑 2. Cancelamento Seguro de Passeio Ativo

- **Novo Botão `✕ Cancelar Passeio`**: Exibido exclusivamente durante um passeio em andamento, posicionado logo abaixo do botão de conclusão.
- **Diálogo de Confirmação**: Evita toques acidentais perguntando se a usuária realmente deseja descartar a sessão em andamento.
- **Limpeza Total**: Cancela cronômetros, limpa fotos temporárias, libera trava de tela (*Wake Lock*), desliga keepalive sonoro e remove a sessão anti-crash do `localStorage`.
- **Alternância de Botões**: O botão de lançamento retroativo manual fica oculto durante o cronômetro ativo, liberando espaço tátil.

---

## 📱 3. Refinamentos Mobile-First (Auditoria iPhone XR)

- **Valores Numéricos e Monetários**: Todos os campos monetários (`R$`) e odômetros (`Km`) agora possuem `inputmode="decimal"` e alinhamento à direita (`text-align: right`), facilitando a digitação no teclado numérico mobile.
- **Padronização de Ações em Modais**: Todos os botões de ação foram harmonizados com ícones representativos (`💾 Salvar...`, `✕ Cancelar`, `✓ Confirmar`).
- **Consistência de Rótulos de Horário**: Padronização para *"Horário Início"* e *"Horário Fim"* em todos os modais.
- **Melhorias de Copy**: Saudação humanizada no topo da aba Passeio (*"Hora do passeio! 🐾"*), e correção gramatical (*"Observações Rápidas de Bem-Estar"*).
## 🐾 4. Redesign do Card de Tutor (Cabeçalho com Largura Total & Anti-Espremimento)

- **Avatar com Iniciais**: Identificação visual rápida de cada tutor com avatar circular em gradiente suave baseado nas iniciais do nome.
- **Cabeçalho sem Espremimento**: O nome, telefone e e-mail agora ocupam **100% da largura útil** do card, garantindo que e-mails longos e números de telefone caibam em linhas únicas sem quebra indesejada.
- **Remoção de Redundâncias**: Remoção do selo duplicado de pets no topo (já detalhado no quadro inferior de pets) e do botão lateral que comprimia os dados de contato em telas mobile.
- **Grade de Serviços Equilibrada**:
  - **🐾 Pets & Banhos**: Lista de pets cadastrados com seus respectivos valores de banho (`🛁 R$ XX,XX`) alinhados e legíveis.
  - **🐕 Passeios**: Nome do grupo e badges de preços por duração (`30m: R$ XX,XX` e `60m: R$ XX,XX`).
- **Ações na Base**: Botão expandido `✏️ Editar Tutor` e botão seguro `🗑️ Excluir`.

## 💰 1. Tela de Faturamento com Totais Mensais Separados

### 📊 Cards Dedicados para Passeios e Banhos
- **Faturamento Total**: Faturamento líquido consolidado do mês com total de tutores atendidos e ajustes.
- **🐾 Total Passeios**: Card exclusivo exibindo o valor total faturado em passeios e quantidade de sessões/pets no mês.
- **🛁 Total Banhos**: Card exclusivo exibindo o valor total faturado em banhos e contagem de banhos/pets no mês.
- **⏱️ Tempo & Distância**: Tempo total dedicado e quilometragem rodada.
- **Layout Mobile 2x2**: Grid responsivo espaçoso que evita cortes horizontais em smartphones e expande para 4 colunas em telas maiores.

---

## 🛁 2. Módulo de Gestão de Banhos

### 🧼 Aba Dedicada na Barra Inferior
- Nova aba **"Banhos"** na barra de navegação principal.
- **Barra de Datas em Cápsula (*Pill Bar*)**: navegação fluida com botões circulares `[ ◀ ]`, `[ Data/Hoje ]` e `[ ▶ ]`.
- **Estatísticas do Dia**: contadores visuais com Total de Banhos e Valor Faturado do dia selecionado.
- **Registro Rápido e Completo**: Lançamento direto com Tutor, Pet (com autopreenchimento do valor cadastrado), Data, Horário de Início/Fim, Valor Cobrado e Observações/Produtos Utilizados.
- **Cards de Banho no Diário**: exibição com badge do pet, horários, valor, observações e botões de editar e excluir.

### 🐶 Precificação Individual de Banho no Cadastro de Tutores
- No cadastro e edição de tutores, os pets agora possuem linha individual com **Nome do Pet**, **Raça** e **Valor do Banho (R$)**.
- Tutores flexíveis:
  - Podem ter **apenas passeios**, **apenas banhos** (valores de passeio opcionais) ou **ambos**.
  - Retrocompatibilidade total garantida para tutores e pets já cadastrados.

### 📑 Faturamento Unificado & Relatórios
- **Fatura Mensal Integrada**: consolida passeios e banhos em **ordem cronológica exata**, separando a contagem de passeios e banhos no resumo do tutor.
- **Resumo no WhatsApp**: texto limpo e humanizado contendo o total de passeios, total de banhos, discriminação cronológica dos atendimentos com ícones representativos (`🐾 Passeio`, `🛁 Banho`), ajustes e chave PIX.
- **E-mail HTML Profissional**: template estilizado com tabela discriminada de itens e design moderno.

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
