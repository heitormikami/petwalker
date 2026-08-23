# 0001. Arquitetura Local-First PWA com Integração Google Apps Script (Google Drive + Gmail)

- **Status**: Aceito (Atualizado de n8n para Google Apps Script)
- **Data**: 2026-08-23

## Contexto

A aplicação Petwalker PWA será utilizada pela passeadora em ambiente de rua durante os passeios com cães, onde a conectividade de rede móvel (3G/4G/5G) pode ser instável ou inexistente. Além disso, a aplicação exige ser extremamente leve, responsiva, segura e com custo zero de infraestrutura (sem necessidade de manter servidores VPS ativos).

Deseja-se sincronizar backups com a conta do Google Drive da usuária, permitir a revisão da fatura/e-mail no laptop antes do envio e disparar e-mails pelo Gmail oficial.

## Decisão

1. **Frontend Local-First PWA**:
   - Construído em **Vanilla JavaScript (ES Modules), HTML5 Semântico e CSS3 Vanilla (sem Tailwind)**.
   - Armazenamento primário no **IndexedDB** do navegador (através do padrão Repository nativo).
   - Suporte completo a **Service Worker (PWA)** para funcionamento offline e instalação na tela inicial.
2. **Segurança Local**:
   - Proteção de acesso à interface via **PIN de 4 dígitos ou Biometria WebAuthn** nativa.
   - Dados sensíveis criptografados localmente com **Web Crypto API (SHA-256 / AES-GCM)**.
3. **Integração Google Apps Script (Google Drive + Gmail)**:
   - O PWA faz chamadas `fetch` assíncronas para um Web App gratuito no Google Apps Script para:
     - **Backup e Sincronização em Nuvem**: envio de snapshots JSON armazenados no Google Drive da passeadora (`petwalker-backup.json`).
     - **Envio de E-mail de Fatura**: disparo pelo Gmail após revisão e autorização da passeadora no computador de casa.
4. **Painel de Pré-visualização de Fatura**:
   - Apasseadora lê o e-mail em HTML na tela do PWA no laptop, insere mensagens personalizadas individuais para cada tutor e decide enviar via Gmail ou aplicativo Web.
5. **Metodologia de Desenvolvimento**:
   - **TDD (Test-Driven Development)**: regras de negócio e formatação de e-mail testadas com testes unitários em JS puro (Node Test Runner).
   - **Spec-Driven Development (SDD)**: especificações mantidas atualizadas no repositório.

## Consequências

### Positivas
- **Custo Zero (R$ 0,00)**: Não exige contratação de servidores VPS ou banco de dados pago.
- **Revisão Humana de E-mail**: A passeadora tem 100% de controle para ler, editar e personalizar recados antes de qualquer e-mail sair.
- **Integração Nativa com Google Drive e Gmail**: Todos os backups ficam guardados no próprio Drive dela.
- **Desempenho Extremo**: Mantém o aplicativo ultraleve sem carregar SDKs pesadas.
