# 📻 Joystream FM — Teambot

Ein Discord-Bot fürs Radio-Team: Sendeplan, On-Air-Meldungen, Meetings mit Zu-/Absage, Azubi-Aufgaben und Team-Tools. Passend zur Server-Struktur von Joystream FM.

## Befehle

| Befehl | Was er macht |
|---|---|
| `/sendeplan anzeigen` | Zeigt den Wochenplan (nur für dich sichtbar) |
| `/sendeplan eintragen` | Trägt eine Sendung ein (Tag, Uhrzeit, Show, optional anderer DJ) |
| `/sendeplan austragen` | Entfernt einen Slot |
| `/sendeplan posten` | Postet den Wochenplan in `📻 · sendeplan` |
| `/onair start` | 🔴 Meldet deine Sendung live in `🎶 · jetzt-läuft` + Bot-Status |
| `/onair ende` | Beendet die Sendung mit Sendezeit-Info |
| `/meeting planen` | Einladung in `📖 · meeting-agenda` mit ✅/❌/🤔-Buttons |
| `/meeting protokoll` | Protokoll-Formular → landet in `📝 · meeting-protokoll` |
| `/aufgabe erstellen` | Vergibt eine Aufgabe an einen Azubi (mit Erledigt-Button) |
| `/aufgabe liste` | Alle offenen Aufgaben |
| `/ankuendigung` | Team-Ankündigung posten (optional mit Team-Ping) |
| `/abwesenheit` | Melden, wenn du ausfällst → `📅 · dienstplan` |
| `/idee` | Idee einreichen → `💡 · ideen` (mit 👍/👎-Abstimmung) |
| `/bug` | Bug melden → `🔧 · bug-meldungen` |
| `/teamhelp` · `/teamping` | Hilfe & Bot-Status |

Alle Team-Befehle sind auf die Rollen aus der `.env` beschränkt (Admins dürfen immer).

## Einrichten

1. **Bot anlegen:** [discord.com/developers/applications](https://discord.com/developers/applications) → New Application → Bot → Token kopieren.
2. **Einladen:** OAuth2 → URL Generator → Scopes `bot` **und** `applications.commands`, Rechte: Nachrichten senden, Embeds, Reaktionen.
3. **Konfigurieren:**
   ```
   copy .env.example .env
   ```
   Dann in der `.env` Token, Rollen-IDs und Channel-IDs eintragen.
   (IDs bekommst du in Discord per Rechtsklick → „ID kopieren“ — Entwicklermodus muss an sein.)
4. **Installieren & Commands registrieren:**
   ```
   npm install
   npm run deploy
   ```
5. **Starten:**
   ```
   npm start
   ```

## Daten

Der Bot speichert Sendeplan, Meetings und Aufgaben in `data/teambot.json` — keine Datenbank nötig. Die Datei wird automatisch angelegt.

## Hinweise

- Channels, die in der `.env` leer bleiben, werden einfach übersprungen bzw. der Befehl sagt dir, welche ID fehlt.
- Der Bot braucht nur den Standard-Intent `Guilds` — keine privilegierten Intents nötig.
