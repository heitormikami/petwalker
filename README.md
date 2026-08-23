# Petwalker 🚀

**Petwalker** – uma aplicação web PWA local‑first para gerenciamento de passeios de pets.

---

## 📦 Tecnologias
- HTML5, CSS (vanilla, design premium)
- JavaScript (ES modules)
- Service Worker para cache offline
- IndexedDB para armazenamento local
- Integração com Google Apps Script (backup/sincronização)
- n8n webhook sync

---

## ✨ Principais funcionalidades
- Listagem, edição e exclusão de tutores com UI responsiva e botões no rodapé dos cards
- Backup versionado no Google Drive
- Exportação de faturas via email
- Sincronização de dados via n8n
- UI moderna com cores vibrantes, tipografia Inter/Outfit e micro‑animações

---

## 🛠️ Instalação e execução local
`ash
# Clone o repositório (já feito)
cd Petwalker
# Inicie um servidor estático simples (Python 3)
python -m http.server 8081
`
Abra o navegador em http://localhost:8081.

---

## 📚 Documentação
- Guia de Google Apps Script: docs/google-apps-script-guide.md
- Setup n8n: docs/n8n-setup-guide.md
- Arquitetura PWA: docs/adr/0001-local-first-pwa-with-google-apps-script.md

---

## 🤝 Contribuindo
Contribuições são bem‑vindas! Abra *issues* ou *pull requests*.

---

## 📄 Licença
Este projeto está sob a licença MIT.
