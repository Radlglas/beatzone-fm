// Registriert die Slash-Commands.
// Loggt sich ein und registriert sie automatisch auf JEDEM Server,
// auf dem der Bot Mitglied ist — keine GUILD_ID nötig.
// Ausführen mit: node deploy.js

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const config = require('./config');
const radio = require('./radio');
const meetings = require('./meetings');
const team = require('./team');
const ausbildung = require('./ausbildung');
const moderation = require('./moderation');

if (!config.TOKEN || !config.CLIENT_ID) {
    console.error('❌ BOT_TOKEN und CLIENT_ID müssen in der .env gesetzt sein.');
    process.exit(1);
}

const commandData = [...radio.commands, ...meetings.commands, ...team.commands, ...ausbildung.commands, ...moderation.commands]
    .map(c => c.data.toJSON());
const rest = new REST({ version: '10' }).setToken(config.TOKEN);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`🔑 Eingeloggt als ${client.user.tag}`);
    const guilds = [...client.guilds.cache.values()];

    if (guilds.length === 0) {
        console.error('❌ Der Bot ist auf KEINEM Server.');
        console.error('   → Lade ihn zuerst ein. Wichtig: Scope "bot" UND "applications.commands"!');
        console.error(`   → https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`);
        process.exit(1);
    }

    console.log(`📡 Registriere auf ${guilds.length} Server …`);
    let ok = 0;
    for (const guild of guilds) {
        try {
            await rest.put(
                Routes.applicationGuildCommands(config.CLIENT_ID, guild.id),
                { body: commandData },
            );
            console.log(`✅ ${commandData.length} Command(s) auf: ${guild.name} (${guild.id})`);
            ok++;
        } catch (err) {
            const msg = err.rawError?.message || err.message;
            console.error(`❌ Fehler auf ${guild.name} (${guild.id}): ${msg}`);
            if (err.status === 403) {
                console.error('   → Der Bot wurde ohne Scope "applications.commands" eingeladen. Bitte neu einladen (Link oben).');
            }
        }
    }
    console.log(`Fertig — ${ok}/${guilds.length} Server erfolgreich.`);
    process.exit(ok > 0 ? 0 : 1);
});

client.login(config.TOKEN);
