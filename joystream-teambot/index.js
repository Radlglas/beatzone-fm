const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('./config');
const store = require('./store');
const radio = require('./radio');
const meetings = require('./meetings');
const team = require('./team');
const ausbildung = require('./ausbildung');
const moderation = require('./moderation');
const startWeb = require('./web');

// ── Start-Check ──────────────────────────────────────────
if (!config.TOKEN) {
    console.error('❌ BOT_TOKEN fehlt in der .env');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

const allCommands = [...radio.commands, ...meetings.commands, ...team.commands, ...ausbildung.commands, ...moderation.commands];
const slashCommands = new Map(allCommands.map(c => [c.data.name, c]));

client.once(Events.ClientReady, c => {
    console.log(`✅ ${config.BRAND.name} Teambot online als ${c.user.tag} (${slashCommands.size} Commands)`);
    const laufend = store.getOnair();
    c.user.setActivity(laufend ? `🔴 LIVE: ${laufend.show}` : `${config.BRAND.name} 📻 | /teamhelp`);
    startWeb(c);   // Web-Panel & API starten
});

// ── Interaktionen routen ─────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const cmd = slashCommands.get(interaction.commandName);
            if (cmd) await cmd.execute(interaction);
            return;
        }
        // Meetings (Zu-/Absage-Buttons & Protokoll-Modal)
        if ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith('meet_')) {
            return meetings.handleComponent(interaction);
        }
        // Ausbildung (Aufgabe-erledigt-Button)
        if (interaction.isButton() && interaction.customId.startsWith('azubi_')) {
            return ausbildung.handleComponent(interaction);
        }
        // Team (Idee- & Bug-Modals)
        if (interaction.isModalSubmit() && interaction.customId.startsWith('team_')) {
            return team.handleComponent(interaction);
        }
    } catch (err) {
        console.error('Interaktions-Fehler:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            interaction.reply({ content: '❌ Etwas ist schiefgelaufen.', ephemeral: true }).catch(() => {});
        }
    }
});

client.login(config.TOKEN);
