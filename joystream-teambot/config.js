require('dotenv').config();

module.exports = {
    // ── Bot ──────────────────────────────────────────────
    TOKEN:     process.env.BOT_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,

    VERSION: '1.1',

    // ── Panel-API (panel.joystream-fm.de) ────────────────
    PANEL_API_BASE: (process.env.PANEL_API_BASE || 'https://panel.joystream-fm.de').replace(/\/$/, ''),

    // ── Channels ─────────────────────────────────────────
    CH: {
        SENDEPLAN:         process.env.SENDEPLAN_CHANNEL_ID         || null,
        JETZT_LAEUFT:      process.env.JETZT_LAEUFT_CHANNEL_ID      || null,
        TEAM_ANNOUNCE:     process.env.TEAM_ANNOUNCE_CHANNEL_ID     || null,
        DIENSTPLAN:        process.env.DIENSTPLAN_CHANNEL_ID        || null,
        IDEEN:             process.env.IDEEN_CHANNEL_ID             || null,
        BUGS:              process.env.BUGS_CHANNEL_ID              || null,
        BOT_LOG:           process.env.BOT_LOG_CHANNEL_ID           || null,
        MEETING_AGENDA:    process.env.MEETING_AGENDA_CHANNEL_ID    || null,
        MEETING_PROTOKOLL: process.env.MEETING_PROTOKOLL_CHANNEL_ID || null,
        AUFGABEN:          process.env.AUFGABEN_CHANNEL_ID          || null,
        FORTSCHRITT:       process.env.FORTSCHRITT_CHANNEL_ID       || null,
        MODLOG:            process.env.MODLOG_CHANNEL_ID            || null,
    },

    // ── Web-Panel & API ──────────────────────────────────
    WEB: {
        // Auf dem Host stellt Pterodactyl den Port als SERVER_PORT bereit
        PORT: parseInt(process.env.SERVER_PORT || process.env.WEB_PORT || '3000', 10),
        // Login fürs Admin-Panel
        USER: process.env.PANEL_USER || 'admin',
        PASSWORD: process.env.PANEL_PASSWORD || null,
        // Wird die öffentliche API aktiviert? (für die Website)
        ENABLE: (process.env.WEB_ENABLE || 'true') !== 'false',
    },

    // ── Rollen ───────────────────────────────────────────
    // Team-Befehle dürfen alle nutzen, die eine dieser Rollen haben
    TEAM_ROLES: [
        process.env.LEITUNG_ROLE_ID,
        process.env.TEAM_ROLE_ID,
    ].filter(Boolean),

    LEITUNG_ROLE: process.env.LEITUNG_ROLE_ID || null,
    AZUBI_ROLE:   process.env.AZUBI_ROLE_ID   || null,

    // ── Joystream FM Stammdaten ──────────────────────────
    BRAND: {
        name:   'Joystream FM',
        slogan: 'Dein Sound. Dein Stream. 🎧',
    },

    // ── Farben (Joystream-Rot) ───────────────────────────
    COLORS: {
        primary: 0xe11d48, // Hauptfarbe (Joystream-Rot)
        live:    0xef4444, // On-Air / Live
        gold:    0xf0c93a, // Ideen / Hinweise
        green:   0x22c55e, // Erledigt / Zusage
        red:     0xdc2626, // Bug / Absage / Ende
    },
};
