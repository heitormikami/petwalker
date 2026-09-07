# 0002. Módulo de Entrada Canônico Único (src/app.js) e Invalidação de Cache via Service Worker

- **Status**: Aceito
- **Data**: 2026-09-07

## Contexto

Historicamente, antes da padronização completa do ciclo de vida do Service Worker (`sw.js`), foram criadas versões clonadas do arquivo de entrada frontend (`app.v2.js`, `app.v3.js`, `app.v4.js`, `app.v5.js`) com o intuito de forçar a quebra manual de cache (*cache-busting*) no Safari do iOS.

Isso gerou uma duplicidade severa: o arquivo `src/app.js` continuava existindo no repositório com ~3.600 linhas, enquanto `index.html` importava `src/app.v5.js` (outras ~3.600 linhas idênticas). Qualquer alteração de funcionalidade ou correção de bug precisava ser replicada manualmente em ambos os arquivos, violando o princípio de **localidade**, dobrando a dívida técnica e criando alto risco de divergência de código.

## Decisão

1. **Módulo de Entrada Canônico Único**:
   - O ponto de entrada oficial e exclusivo da aplicação é **`src/app.js`**.
   - O arquivo `src/app.v5.js` foi definitivamente removido (passando no *teste da deleção*).
   - O `index.html` passa a carregar exclusivamente `<script type="module" src="src/app.js?v=XX"></script>`.

2. **Proibição de Sufixos de Versão em Nomes de Arquivo**:
   - É terminantemente proibido criar arquivos versionados em disco (ex: `app.v6.js`, `storage.v2.js`).
   - A invalidação de cache e a gestão de ciclo de vida de ativos pertencem **exclusivamente ao Service Worker (`sw.js`)** através da constante `CACHE_NAME` (ex: `petwalker-v38`) e parâmetros de query (`?v=38`).

3. **Mecanismo de Invalidação no Service Worker**:
   - Ao lançar uma nova versão, incrementa-se a constante `CACHE_NAME` no `sw.js`.
   - O evento `activate` do Service Worker purga automaticamente todas as chaves de cache que não correspondem ao `CACHE_NAME` ativo, garantindo atualização instantânea nos clientes instalados.

## Consequências

### Positivas
- **Localidade Restaurada**: Desenvolvedores e agentes trabalham em um único módulo de entrada; cada bugfix ou feature é aplicado uma única vez.
- **Redução de 3.600 Linhas de Código**: Eliminação total de código fantasma/zumbi no repositório.
- **Conformidade com o Teste da Deleção**: Deletar o clone reduziu a complexidade sem mover nenhuma regra de negócio.
- **Risco Zero de Divergência**: Fim do risco de `app.js` e `app.v5.js` estarem em estados dessincronizados.
