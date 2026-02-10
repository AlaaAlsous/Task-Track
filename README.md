# Task Track

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![VS Code](https://img.shields.io/badge/VS%20Code-007ACC?logo=visualstudiocode&logoColor=white)
![Nodemon](https://img.shields.io/badge/nodemon-76D04B?logo=nodemon&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Beskrivning

Task Track är en komplett fullstack-applikation för att hantera personliga uppgifter (to-dos). Backend är byggd i Express (Node.js) med sessionsbaserad inloggning, och frontend är en ren HTML/CSS/JS-klient som körs som statisk resurs. Varje användare lagras i en central fil (users.json) och får sina uppgifter sparade separat i Users/<userId>.json. Systemet stödjer inloggning/utloggning, skapande/redigering/borttagning av uppgifter, markering som klara, sortering, kategorier och deadlines med visuella varningar när 1 dag eller 1 timme återstår.

Arkitekturen är avsiktligt enkel och filbaserad, vilket gör den lätt att köra lokalt utan externa databaser. Sessionscookies används för autentisering, och API:t är tydligt uppdelat i auth-endpoints och tasks-endpoints. Frontenden pratar med API:t via fetch-anrop och renderar listor, formulär och notifieringar direkt i DOM.

Backend-exponeringen består av två huvudsakliga delar:

- Autentisering (`/api/auth/*`): Registrering hashar lösenord med bcrypt (cost 10) och sparar användare i `users.json`. Inloggning verifierar hash och sätter en sessionscookie (`sid`). Utloggning tar bort sessionen. `GET /api/auth/me` returnerar inloggad användare eller `401` om ingen session finns.
- Uppgifter (`/api/tasks`): Alla endpoints är skyddade bakom session. Uppgifterna sparas per användare i `Users/<id>.json` som en JSON-array. Skapa (`POST`) kräver minst `taskText`. Uppdatera (`PATCH /:id`) validerar fält: `priority` måste vara en av `Low|Medium|High`, `category` en av `Private|Work|School|No Category`, och `deadline` måste följa formatet `YYYY-MM-DDTHH:MM` eller vara `null`. Borttagning (`DELETE /:id`) tar bort uppgiften.

Frontenden (under `public/`) presenterar ett enkelt UI:

- Startsida med formulär för ny uppgift (text, prioritet, deadline, kategori) och en lista med befintliga uppgifter.
- Inloggningsmodal med växling mellan "Sign In" och "Register"; efter inloggning ändras nav-länken till "Sign Out (username)".
- Sorteringsalternativ: efter ID, prioritet eller kategori; default-sortering är efter närmaste deadline.
- Visuella indikatorer: uppgifter inom 1 dag eller 1 timme markeras (klasser `one-day-left`, `one-hour-left`), utgången deadline markeras med `Expired!`. När en uppgift markeras som klar visas en kort notifiering och notifieringar visas när en uppgift skapas, uppdateras, eller tas bort, så att användaren alltid får tydlig feedback på sina handlingar.

## Projektstruktur

```text
Task-Track/
├─ nodemon.json
├─ package.json
├─ README.md
├─ server.js
├─ users.json
├─ public/
│  ├─ 404.html
│  ├─ about.html
│  ├─ index.html
│  ├─ index.js
│  └─ styles.css
└─ Users/
```

## English Summary

Task Track is a `Node.js` and `Express` app with a static frontend. Users can register/login, then create, edit, delete and mark tasks as done. Each user’s tasks are stored in flat JSON files under Users/<id>.json, while the user registry lives in users.json.

Run it with:

```bash
cd Task-Track
npm install
npm run dev
```

Or start without nodemon:

```bash
npm start
```

## Huvudmeny

Webbgränssnittet innehåller:

- Home – Startsidan med uppgiftslistan
- Add Task – Formulär för att lägga till ny uppgift
- View Tasks – Scroll/sektion för alla uppgifter
- About – Statisk infosida
- Sign In / Sign Out – Inloggning/utloggning via modal

Status visas i UI:t: antal uppgifter totalt, antal klara, samt visualisering av deadlines. Notifieringar bekräftar åtgärder (t.ex. "Task Added!", "Task Deleted!").

## Sorterings- och filtreringsval

- Sort by ID – Sorterar efter uppgifts-ID
- Sort by Priority – Sorterar efter prioritet (High, Medium, Low)
- Sort by Category – Sorterar efter kategori (Private, Work, School, No Category)
- Default-sortering – Efter närmaste deadline

## Funktioner

- Autentisering: Registrering, inloggning, utloggning via sessionscookies
- Per-användarlagring: Uppgifter sparas i Users/<id>.json
- CRUD för uppgifter: Skapa, hämta, uppdatera (text, done, deadline, kategori, prioritet), ta bort
- Deadlines: Varningar för ≤1 dag kvar, ≤1 timme kvar, och utgången deadline (Expired!)
- Sortering och räkning: Antal totalt/klara; sortera efter ID/prioritet/kategori eller deadline
- Inline-redigering: Direktredigering av uppgift med "Save"/"Cancel"
- Notifieringar: Bekräftelser vid add/update/complete/delete

## Så här kör du programmet

1. Klona eller öppna projektet
2. Installera beroenden

```powershell
npm install
```

3. Starta utvecklingsserver:

```powershell
npm run dev
```

Alternativt start utan nodemon:

```powershell
npm start
```

## Vad användaren gör efter att programmet startar

- Inloggning: Klicka på "Sign In" i nav, använd modal för login/registrering
- Skapa uppgift: Fyll i text, prioritet, deadline och kategori, klicka "Add"
- Hantera uppgifter:
  - Markera som klar (checkbox)
  - Redigera ("Edit" → ändra → "Save"/"Cancel")
  - Ta bort ("X")
- Sortering: Kryssa i önskad sortering (ID/Priority/Category) eller kör default (deadline)
- Notifieringar: Bekräftelser visas kort i nederkant

## API-endpoints

Autentisering

- POST /api/auth/register – Skapar användare och loggar in
- POST /api/auth/login – Loggar in
- POST /api/auth/logout – Loggar ut
- GET /api/auth/me – Hämtar inloggad användare

Uppgifter (kräver inloggning)

- GET /api/tasks – Hämtar alla uppgifter för användaren
- POST /api/tasks – Skapar ny uppgift
- PATCH /api/tasks/:id – Uppdaterar uppgift (done, text, deadline, kategori, prioritet)
- DELETE /api/tasks/:id – Raderar uppgift

## Datafiler

- users.json – Lista över registrerade användare (id, username, passwordHash, createdAt)
- Users/<id>.json – Uppgifterna för respektive användar-ID

### Exempel: users.json

```json
[
  {
    "id": 1,
    "username": "alaa",
    "passwordHash": "$2b$10$...",
    "createdAt": "2026-02-10T12:00:00.000Z"
  }
]
```

### Exempel: Users/1.json

```json
[
  {
    "id": 1,
    "taskText": "Buy milk",
    "priority": "High",
    "deadline": "2026-02-11T09:30",
    "category": "Private",
    "done": false
  }
]
```

Data lagras som en JSON-array per användare. Filen skapas automatiskt när användaren börjar lägga till uppgifter. Mapp `Users` skapas vid serverstart om den saknas.

## Utvecklare

Alaa Alsous

## Språk, Plattform, Verktyg

- Språk: JavaScript
- Plattform: Node.js / Express; Frontend: HTML/CSS/JS
- Verktyg: VS Code, Nodemon
