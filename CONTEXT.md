# Glossário de Domínio - Petwalker

Este documento define a linguagem ubíqua (Ubiquitous Language) do sistema Petwalker PWA.

## Entidades Principais

### Tutor (Cliente / Responsável)
Pessoa ou família responsável por um ou mais Pets. É a entidade financeira a quem as Faturas Mensais são destinadas.
- **Campos**: Nome, E-mail, Telefone/WhatsApp, Endereço Principal, Observações.

### Pet
Animal de estimação associado a um Tutor.
- **Campos**: Nome, Raça, Idade/Porte, Recomendações Especiais.

### Grupo de Passeio (Contrato de Passeio)
Agrupamento de um ou mais Pets do mesmo Tutor que passeiam juntos em uma mesma sessão de horário. O valor do passeio é negociado por **Horário/Sessão** (não por pet individual).
- **Valores Contratados**:
  - Valor Sessão 30 minutos (ex: R$ 40,00)
  - Valor Sessão 60 minutos (ex: R$ 70,00)

### Sessão de Passeio (Walk Session)
Registro operacional de um passeio realizado.
- **Dados Temporais**: Data, Horário Inicial Efetivo, Horário Final Efetivo.
- **Duração Contratada**: 30 minutos ou 60 minutos (usada estritamente para o cálculo financeiro).
- **Custo Histórico Congelado**: O valor do passeio é gravado na sessão no momento de sua realização (`cost`), garantindo que reajustes futuros de preços não alterem faturas de meses passados.
- **Vínculo**: Grupo de Passeio / Tutor.
- **Anotações & Fotos**: Disposição do pet, necessidades fisiológicas (xixi/cocô), ocorrências e foto comprimida (WebP/Canvas).
- **Local/Rota**: Bairro ou local do passeio.

### Fatura Mensal (Monthly Invoice)
Consolidação financeira mensal gerada para um Tutor.
- **Período**: Mês/Ano de referência.
- **Itens de Passeio**: Lista de Sessões de Passeio realizadas no mês × Valor Histórico Gravado da sessão.
- **Ajustes**: Soma de Créditos (-), Débitos (+) ou Descontos passados.
- **Total a Pagar**: Valor líquido final apurado.

### Ajuste Financeiro (Financial Adjustment)
Lançamento financeiro avulso atrelado a um Tutor para ser compensado na Fatura Mensal.
- **Tipos**: Crédito (abatimento), Débito (serviço extra como Dog Shower), Desconto.

---

## Fluxo Operacional & Múltiplos Dispositivos

1. **Passeio na Rua (Celular)**: Noiva inicia e conclui o passeio no celular (100% offline). O app salva no `IndexedDB` local e grava o custo histórico da sessão.
2. **Sincronização Nuvem (VPS n8n)**: Assim que o celular conecta na rede ou ao concluir o passeio, os dados são sincronizados via Webhook n8n.
3. **Gestão e Fechamento em Casa (Laptop)**: Ao abrir a URL do PWA no computador de casa, o app busca o snapshot sincronizado via n8n, permitindo revisar passeios, ajustar valores e emitir faturas no conforto do laptop.
