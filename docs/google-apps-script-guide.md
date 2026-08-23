# Guia do Google Apps Script (Com Versionamento de Backups) - Petwalker PWA

Este guia ensina como publicar o script no **Google Apps Script** para salvar os backups em uma pasta dedicada **`Petwalker_Backups`** no Google Drive, com **histórico de versões** para que você possa escolher qualquer data passada na hora de restaurar.

---

## 🎯 O que este script faz?

1. **Pasta Dedicada**: Cria e gerencia a pasta `Petwalker_Backups` no seu Google Drive.
2. **Histórico de Versões (`action: "backup_sync"`)**: Salva um arquivo atualizado (`petwalker-latest.json`) E gera uma versão com data/hora (ex: `backup-2026-08-23_18-30.json`).
3. **Listar Histórico (`action: "list_backups"`)**: Retorna a lista de todos os backups salvos com data, hora e tamanho do arquivo.
4. **Restaurar Versão Específica (`action: "pull_sync"`)**: Restaura o arquivo selecionado pela usuária.
5. **Envio de E-mail de Fatura (`action: "send_invoice_email"`)**: Dispara e-mails pelo Gmail oficial.

---

## 🛠️ Código Completo do Google Apps Script

```javascript
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var folder = getOrCreateFolder('Petwalker_Backups');

    // 1. SALVAR BACKUP (LATEST + CÓPIA COM DATA/HORA)
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

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Backup versionado salvo na pasta Petwalker_Backups!'
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
## 📄 Atualizações de Documentação

A interface de listagem de tutores foi refinada:
- Botões **Editar** e **Excluir** foram movidos para a base dos cards, garantindo que nome, telefone e e‑mail tenham espaço total.
- Layout responsivo com `word‑break` e espaçamento adequado, evitando compressão em telas menores.

Essas melhorias não alteram a lógica do Apps Script, mas oferecem melhor experiência ao usuário ao gerenciar tutores.
