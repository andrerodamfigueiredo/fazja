# ⚡ Faz Já — Gestor de Tarefas por Voz

Gestor de tarefas por voz para ADHD. Dois slots (Manhã/Tarde), voz em português, arrasto com o dedo, recompensas por streak.

---

## Instalação Rápida

### 1. Instalar Node.js
Vai a [nodejs.org](https://nodejs.org) e instala a versão **18 ou superior**.

### 2. Obter chave Anthropic
Vai a [console.anthropic.com](https://console.anthropic.com) → API Keys → cria uma chave.

### 3. Correr o Faz Já

```bash
cd ~/fazja
bash start.sh
```

Introduz a tua chave Anthropic quando pedido.  
O script instala as dependências, gera as chaves VAPID e inicia o servidor.

### 4. Abrir no Android

1. Abre o **Chrome** no Android
2. Vai a `http://192.168.x.x:3001` (o IP aparece no terminal)
3. Menu (⋮) → **"Adicionar ao ecrã inicial"**
4. O ícone aparece no ecrã — abre como app nativa!

---

## Funcionalidades

### 🎤 Voz
- Carrega no botão azul ⚡ e fala em português
- "Ligar ao João às 10h" → aparece em Manhã com hora
- "Enviar proposta à tarde" → aparece em Tarde
- A IA atribui o emoji certo automaticamente

### 👇 Arrastar Tarefas
- Segura o ☰ (lado direito do card) e arrasta
- Reordena dentro do mesmo slot
- Arrasta de Manhã para Tarde e vice-versa
- A ordem fica guardada automaticamente

### ✅ Marcar como Feito
- Carrega em "✓ FEITO" → animação verde + som
- Streak actualiza + celebração aparece
- Tarefa move-se para "Concluídas hoje"

### 🔥 Streak
- Completa pelo menos uma tarefa por dia para manter o streak
- 7 dias → celebração especial
- 30 dias → LENDÁRIO com confetti!

### 🔔 Notificações (opcional)

Para receber lembretes no Android:

1. Abre `chrome://flags` no Android Chrome
2. Pesquisa "Insecure origins treated as secure"
3. Activa e adiciona `http://192.168.x.x:3001`
4. Reinicia o Chrome
5. Na app, aceita as notificações quando pedido

---

## Integração com Gemini (URL Scheme)

Podes dizer ao Gemini: *"Adiciona ao Faz Já: Ligar ao Carlos"*

O Gemini pode abrir: `http://192.168.x.x:3001/add?task=Ligar+ao+Carlos`

---

## Estrutura de Ficheiros

```
fazja/
├── backend/
│   ├── server.js      ← API Express
│   ├── db.js          ← SQLite
│   ├── push.js        ← Web Push
│   ├── reminders.js   ← Lembretes automáticos
│   └── package.json
├── frontend/
│   ├── index.html     ← App completa
│   ├── sw.js          ← Service Worker
│   ├── manifest.json  ← PWA
│   └── icon.svg
├── .env               ← Chaves (criado automaticamente)
├── start.sh
└── README.md
```

---

## Problemas Frequentes

**Voz não funciona:**
- Precisa de HTTPS ou activar a flag do Chrome (ver acima)
- Se não funcionar, carrega em ✍️ para escrever manualmente

**Notificações não chegam:**
- Confirma que activaste o flag do Chrome
- Aceita as notificações na app

**Erro de API key:**
- Apaga o ficheiro `.env` e corre `bash start.sh` de novo
