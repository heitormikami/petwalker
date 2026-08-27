# Guia do Google Apps Script (Com Versionamento & Retenção Inteligente de Backups) - Petwalker PWA

Este guia fornece o código atualizado do **Google Apps Script** para salvar os backups na pasta **`Petwalker_Backups`** no seu Google Drive com **política automática de retenção e limpeza**.

---

## 🎯 Política Inteligente de Retenção de Backups

O script executa a limpeza automática após cada sincronização de backup:

1. **Backups Recentes (Últimos 20 dias)**:
   - **100% preservados**. Todos os backups granulares (diários ou por passeio) ficam disponíveis para restaurar a qualquer momento.
2. **Backups Mensais (Entre 21 dias e 1 ano)**:
   - O script preserva automaticamente o **último backup de cada mês** como histórico consolidado.
   - Backups diários intermediários com mais de 20 dias são descartados para economizar espaço.
3. **Expiração Anual (> 1 ano)**:
   - Backups mensais com mais de 365 dias são excluídos definitivamente.
4. **Arquivo Atual (`petwalker-latest.json`)**:
   - Sempre preservado com o snapshot mais recente.

---

## 🛠️ Código Completo do Google Apps Script

Copie e cole este código no seu projeto do **Google Apps Script**:

```javascript
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Política de Retenção Automática:
 * - Mantém todos os backups dos últimos 20 dias.
 * - Para backups com mais de 20 dias: mantém apenas o último backup de cada mês.
 * - Exclui backups com mais de 1 ano (365 dias).
 */
function cleanupOldBackups(folder) {
  var now = new Date();
  var twentyDaysAgo = new Date(now.getTime() - (20 * 24 * 60 * 60 * 1000));
  var oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));

  var files = folder.getFiles();
  var versionFiles = [];

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();

    // Ignora o arquivo petwalker-latest.json
    if (name === 'petwalker-latest.json') continue;

    if (name.startsWith('backup-') && name.endsWith('.json')) {
      versionFiles.push({
        file: file,
        name: name,
        updatedAt: file.getLastUpdated()
      });
    }
  }

  // Ordenar do mais novo para o mais antigo
  versionFiles.sort(function(a, b) {
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  var monthlyKept = {};

  for (var i = 0; i < versionFiles.length; i++) {
    var item = versionFiles[i];
    var fileDate = item.updatedAt;
    var monthKey = fileDate.getFullYear() + '-' + (fileDate.getMonth() + 1);

    // 1. Mais de 1 ano -> Excluir
    if (fileDate < oneYearAgo) {
      item.file.setTrashed(true);
      continue;
    }

    // 2. Últimos 20 dias -> Manter todos
    if (fileDate >= twentyDaysAgo) {
      continue;
    }

    // 3. Entre 21 dias e 1 ano -> Manter apenas o último do mês
    if (!monthlyKept[monthKey]) {
      monthlyKept[monthKey] = true; // Preserva o mais recente daquele mês
    } else {
      item.file.setTrashed(true); // Descarta os intermediários daquele mês
    }
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var folder = getOrCreateFolder('Petwalker_Backups');

    // 1. SALVAR BACKUP (LATEST + CÓPIA COM DATA/HORA + LIMPEZA AUTOMÁTICA)
    if (action === 'backup_sync') {
      var latestName = 'petwalker-latest.json';
      var now = new Date();
      var dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').substring(0, 16);
      var versionName = 'backup-' + dateStr + '.json';
      var content = JSON.stringify(data.payload, null, 2);

      // Atualizar ou criar o latest
      var latestFiles = folder.getFilesByName(latestName);
      if (latestFiles.hasNext()) {
        latestFiles.next().setContent(content);
      } else {
        folder.createFile(latestName, content, MimeType.PLAIN_TEXT);
      }

      // Criar cópia versionada no histórico
      folder.createFile(versionName, content, MimeType.PLAIN_TEXT);

      // Executar limpeza automática conforme regras de retenção (20 dias / mensal / 1 ano)
      cleanupOldBackups(folder);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Backup salvo com sucesso no Google Drive (com retenção automática de 20 dias e mensal)!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. LISTAR TODOS OS BACKUPS SALVOS
    if (action === 'list_backups') {
      var files = folder.getFiles();
      var list = [];

      while (files.hasNext()) {
        var file = files.next();
        list.push({
          name: file.getName(),
          size: file.getSize(),
          updatedAt: file.getLastUpdated().toISOString()
        });
      }

      // Ordenar do mais recente para o mais antigo
      list.sort(function(a, b) {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        backups: list
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. PUXAR/RESTAURAR BACKUP (LATEST OU NOME ESPECÍFICO)
    if (action === 'pull_sync') {
      var targetName = data.fileName || 'petwalker-latest.json';
      var files = folder.getFilesByName(targetName);

      if (!files.hasNext()) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Arquivo ' + targetName + ' não foi encontrado na pasta Petwalker_Backups.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var content = files.next().getBlob().getDataAsString();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileName: targetName,
        payload: JSON.parse(content)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. ENVIAR E-MAIL DA FATURA VIA GMAIL
    if (action === 'send_invoice_email') {
      GmailApp.sendEmail(
        data.recipientEmail,
        'Fechamento de Passeios Petwalker - ' + (data.periodMonthYear || ''),
        'Seu leitor de e-mail não suporta HTML. Por favor, visualize em um navegador.',
        {
          name: 'Petwalker Passeios',
          htmlBody: data.htmlContent
        }
      );

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'E-mail enviado com sucesso para ' + data.recipientEmail + ' via Gmail!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 🚀 Como Atualizar no Google Apps Script

1. Abra seu projeto no [script.google.com](https://script.google.com).
2. Substitua o conteúdo do arquivo `Código.gs` pelo código acima.
3. Clique em **Salvar (💾)**.
4. Clique em **Implantar > Gerenciar Implantações**.
5. Clique no ícone de lápis (✏️) da implantação ativa, selecione **Nova Versão** e clique em **Implantar**.
