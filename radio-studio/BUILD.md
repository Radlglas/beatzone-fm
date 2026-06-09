# RadioFlare — Build-Anleitung

## Voraussetzungen
- Node.js ≥ 18  (https://nodejs.org)
- npm ≥ 9

## Schnellstart (Entwicklung)

```bash
cd radio-studio
npm install
npm start
```

Das öffnet die App direkt im Electron-Fenster.

## Entwicklungsmodus (mit DevTools)

```bash
NODE_ENV=development npm start
```

## Windows-Installer bauen (.exe / NSIS)

```bash
npm run build:win
```

Die fertige Installationsdatei liegt danach in `dist/`.

## Streaming zu Icecast 2 einrichten

1. App starten → oben rechts **Einstellungen** klicken
2. Tab **Senden / Verbindung**
3. Felder ausfüllen:
   - Protokoll: `Icecast 2`
   - Host: deine Serveradresse (z.B. `stream.meinradio.de`)
   - Port: `8000`
   - Mountpoint: `/live` oder `/stream`
   - Passwort: Source-Passwort aus icecast.xml
4. **Speichern** → **Verbinden**
5. Der **ON AIR**-Badge leuchtet orange wenn verbunden

### MP3-Encoding (lamejs)
`npm install` installiert automatisch `lamejs`.
Wenn kein lamejs → Fallback auf WebM/Opus (nicht MP3).

## Tastaturkürzel

| Taste        | Aktion              |
|--------------|---------------------|
| Space        | Deck A Play/Pause   |
| Enter        | Deck B Play/Pause   |
| Q            | Deck A CUE          |
| W            | Deck B CUE          |
| S            | Deck A Sync         |
| D            | Deck B Sync         |
| 1–8          | Hot Cue A 1–8       |
| Shift+1–8    | Hot Cue B 1–8       |

## Drag & Drop

- Library-Track → Deck A oder B ziehen
- Library-Track → Sampler-Pad ziehen

## Auto-DJ

Master Bar → **AUTO-DJ: AN** (oder Automation-Tab)  
Warteschlange füllen → Auto-DJ spielt automatisch durch mit Crossfade.

## Sendeplan / Scheduler

1. Tab **Automation** → **Sendeplan**
2. Uhrzeit + Typ + Track-Name eingeben → **+ Hinzufügen**
3. **▶ Starten** → Scheduler prüft jede Sekunde ob ein Event fällig ist
4. Bei Übereinstimmung: lädt den Track und spielt ihn ab

## Dateien

```
radio-studio/
├── main.js          Electron-Hauptprozess (Dateisystem, Streaming-TCP)
├── preload.js       IPC-Bridge (sicherer Kanal Renderer ↔ Main)
├── src/
│   ├── index.html   Haupt-UI
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── renderer.js          App-Controller
│       ├── audio-engine.js      Web Audio API Engine
│       ├── waveform.js          Canvas-Wellenform
│       ├── library.js           Musikbibliothek
│       ├── scheduler.js         Sendeplan-Automatisierung
│       ├── streaming.js         Icecast-Streaming (Renderer-Seite)
│       └── audio-capture-worklet.js  AudioWorklet für PCM-Capture
└── BUILD.md         Diese Datei
```
