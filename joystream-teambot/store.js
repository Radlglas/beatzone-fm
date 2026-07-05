// Winzige JSON-Persistenz für den Teambot.
// Hält Sendeplan, Meetings, Aufgaben, die aktuelle Sendung sowie
// Warns / Notizen / Modlog in einer einzigen data/teambot.json —
// kein Datenbank-Setup nötig.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'teambot.json');

const DEFAULT = {
    // Sendeplan: pro Wochentag eine Liste von Slots { von, bis, show, userId }
    sendeplan: { Mo: [], Di: [], Mi: [], Do: [], Fr: [], Sa: [], So: [] },
    // Aktuelle Sendung (oder null): { show, djId, seit }
    onair: null,
    // Meetings mit Zu-/Absagen, Key = Message-ID des Agenda-Posts
    meetings: {},
    // Azubi-Aufgaben: fortlaufende Nummer + Aufgaben nach ID
    aufgabenCounter: 0,
    aufgaben: {},
    // ── Team-Verwaltung ──────────────────────────────────
    // Warns pro User: { userId: [ {id, reason, modId, modTag, ts} ] }
    warns: {},
    warnCounter: 0,
    // Interne Notizen pro User: { userId: [ {id, text, modId, modTag, ts} ] }
    notes: {},
    noteCounter: 0,
    // Modlog (letzte ~200 Aktionen): [ {ts, action, targetId, targetTag, modId, modTag, reason} ]
    modlog: [],
};

function load() {
    try {
        return { ...structuredClone(DEFAULT), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
    } catch {
        return structuredClone(DEFAULT);
    }
}

let state = load();

function save() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

module.exports = {
    // ── Sendeplan ────────────────────────────────────────
    getSendeplan() {
        return state.sendeplan;
    },

    addSlot(tag, slot) {
        state.sendeplan[tag].push(slot);
        state.sendeplan[tag].sort((a, b) => a.von.localeCompare(b.von));
        save();
    },

    removeSlot(tag, von) {
        const idx = state.sendeplan[tag].findIndex(s => s.von === von);
        if (idx === -1) return null;
        const [slot] = state.sendeplan[tag].splice(idx, 1);
        save();
        return slot;
    },

    // ── On-Air ───────────────────────────────────────────
    getOnair() {
        return state.onair;
    },

    setOnair(sendung) {
        state.onair = sendung;
        save();
    },

    // ── Meetings ─────────────────────────────────────────
    getMeeting(messageId) {
        return state.meetings[messageId] || null;
    },

    addMeeting(messageId, meeting) {
        state.meetings[messageId] = meeting;
        save();
    },

    saveMeetings() {
        save();
    },

    // ── Aufgaben ─────────────────────────────────────────
    nextAufgabenNr() {
        state.aufgabenCounter += 1;
        save();
        return state.aufgabenCounter;
    },

    getAufgabe(id) {
        return state.aufgaben[id] || null;
    },

    addAufgabe(aufgabe) {
        state.aufgaben[aufgabe.id] = aufgabe;
        save();
    },

    updateAufgabe(id, patch) {
        if (state.aufgaben[id]) {
            Object.assign(state.aufgaben[id], patch);
            save();
        }
    },

    offeneAufgaben() {
        return Object.values(state.aufgaben).filter(a => !a.done);
    },

    alleAufgaben() {
        return Object.values(state.aufgaben);
    },

    // ── Warns ────────────────────────────────────────────
    addWarn(userId, warn) {
        state.warnCounter += 1;
        const entry = { id: state.warnCounter, ts: Date.now(), ...warn };
        (state.warns[userId] ||= []).push(entry);
        save();
        return entry;
    },

    getWarns(userId) {
        return state.warns[userId] || [];
    },

    // Ein bestimmtes Warn (per ID) eines Users entfernen
    removeWarn(userId, warnId) {
        const list = state.warns[userId];
        if (!list) return null;
        const idx = list.findIndex(w => w.id === warnId);
        if (idx === -1) return null;
        const [removed] = list.splice(idx, 1);
        if (list.length === 0) delete state.warns[userId];
        save();
        return removed;
    },

    clearWarns(userId) {
        const count = (state.warns[userId] || []).length;
        delete state.warns[userId];
        save();
        return count;
    },

    // Alle Warns flach (fürs Web-Panel)
    allWarns() {
        const out = [];
        for (const [userId, list] of Object.entries(state.warns)) {
            for (const w of list) out.push({ userId, ...w });
        }
        return out.sort((a, b) => b.ts - a.ts);
    },

    // ── Notizen ──────────────────────────────────────────
    addNote(userId, note) {
        state.noteCounter += 1;
        const entry = { id: state.noteCounter, ts: Date.now(), ...note };
        (state.notes[userId] ||= []).push(entry);
        save();
        return entry;
    },

    getNotes(userId) {
        return state.notes[userId] || [];
    },

    removeNote(userId, noteId) {
        const list = state.notes[userId];
        if (!list) return null;
        const idx = list.findIndex(n => n.id === noteId);
        if (idx === -1) return null;
        const [removed] = list.splice(idx, 1);
        if (list.length === 0) delete state.notes[userId];
        save();
        return removed;
    },

    allNotes() {
        const out = [];
        for (const [userId, list] of Object.entries(state.notes)) {
            for (const n of list) out.push({ userId, ...n });
        }
        return out.sort((a, b) => b.ts - a.ts);
    },

    // ── Modlog ───────────────────────────────────────────
    logAction(entry) {
        state.modlog.unshift({ ts: Date.now(), ...entry });
        if (state.modlog.length > 200) state.modlog.length = 200;
        save();
    },

    getModlog(limit = 50) {
        return state.modlog.slice(0, limit);
    },
};
