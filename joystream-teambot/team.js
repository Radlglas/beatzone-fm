// Team-Tools: Hilfe, Ankündigungen, Abwesenheit, Ideen & Bug-Meldungen.

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const config = require('./config');
const { brandEmbed, requireTeam, postTo } = require('./util');

const B = config.BRAND;
const startedAt = Date.now();

function fmtUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${s % 60}s`);
    return parts.join(' ');
}

const commands = [
    // /teamhelp
    {
        data: new SlashCommandBuilder().setName('teamhelp').setDescription('Übersicht aller Teambot-Befehle'),
        async execute(interaction) {
            const embed = brandEmbed('🤖 Teambot — Hilfe & Befehle')
                .setDescription(`Alle Befehle vom **${B.name} Teambot v${config.VERSION}**`)
                .addFields(
                    { name: '📻 Radio', value: '`/sendeplan anzeigen · eintragen · austragen · posten`\n`/onair start · ende`' },
                    { name: '📖 Meetings', value: '`/meeting planen` — Einladung mit Zu-/Absage-Buttons\n`/meeting protokoll` — Protokoll schreiben' },
                    { name: '🎓 Ausbildung', value: '`/aufgabe erstellen` — Aufgabe an Azubi vergeben\n`/aufgabe liste` — offene Aufgaben' },
                    { name: '👥 Team', value: '`/ankuendigung` — Team-Ankündigung posten\n`/abwesenheit` — melden, wenn du ausfällst\n`/idee` — Idee einreichen · `/bug` — Bug melden' },
                    { name: '🛡️ Verwaltung', value: '`/warn` · `/warns` · `/unwarn` · `/clearwarns`\n`/note` · `/notes` · `/timeout` · `/untimeout`\n`/kick` · `/ban` · `/modlog`' },
                    { name: '🔧 Sonstiges', value: '`/teamping` — Bot-Status · `/teamhelp` — diese Hilfe' },
                )
                .setFooter({ text: B.slogan });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        },
    },

    // /teamping
    {
        data: new SlashCommandBuilder().setName('teamping').setDescription('Zeigt Bot-Status, Latenz und Uptime'),
        async execute(interaction) {
            const embed = brandEmbed('🏓 Pong!')
                .addFields(
                    { name: 'Latenz', value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
                    { name: 'Uptime', value: fmtUptime(Date.now() - startedAt), inline: true },
                    { name: 'Version', value: `v${config.VERSION}`, inline: true },
                );
            await interaction.reply({ embeds: [embed], ephemeral: true });
        },
    },

    // /ankuendigung
    {
        data: new SlashCommandBuilder()
            .setName('ankuendigung')
            .setDescription('Postet eine Ankündigung ins Team-Ankündigungs-Channel (Team)')
            .addStringOption(o => o.setName('titel').setDescription('Überschrift').setRequired(true).setMaxLength(100))
            .addStringOption(o => o.setName('text').setDescription('Der Ankündigungstext').setRequired(true).setMaxLength(1500))
            .addBooleanOption(o => o.setName('ping').setDescription('Team-Rolle anpingen? (Standard: nein)')),
        async execute(interaction) {
            if (!await requireTeam(interaction)) return;
            const embed = brandEmbed(`📣 ${interaction.options.getString('titel')}`)
                .setDescription(interaction.options.getString('text'))
                .setFooter({ text: `Von ${interaction.user.tag}` })
                .setTimestamp();
            const ping = interaction.options.getBoolean('ping') && config.TEAM_ROLES[0]
                ? `<@&${config.TEAM_ROLES[0]}>` : undefined;
            const msg = await postTo(interaction.guild, config.CH.TEAM_ANNOUNCE, { content: ping, embeds: [embed] });
            if (!msg) {
                return interaction.reply({ content: '❌ Ankündigungs-Channel nicht gefunden — `TEAM_ANNOUNCE_CHANNEL_ID` in der .env prüfen.', ephemeral: true });
            }
            return interaction.reply({ content: `✅ Ankündigung gepostet in ${msg.channel}.`, ephemeral: true });
        },
    },

    // /abwesenheit
    {
        data: new SlashCommandBuilder()
            .setName('abwesenheit')
            .setDescription('Melde dem Team, dass du ausfällst (Team)')
            .addStringOption(o => o.setName('von').setDescription('Ab wann? z. B. 12.07.').setRequired(true).setMaxLength(40))
            .addStringOption(o => o.setName('bis').setDescription('Bis wann? z. B. 19.07.').setRequired(true).setMaxLength(40))
            .addStringOption(o => o.setName('grund').setDescription('Grund (optional)').setMaxLength(200)),
        async execute(interaction) {
            if (!await requireTeam(interaction)) return;
            const grund = interaction.options.getString('grund');
            const embed = brandEmbed('🏖️ Abwesenheit', config.COLORS.gold)
                .setDescription(`${interaction.user} ist **von ${interaction.options.getString('von')} bis ${interaction.options.getString('bis')}** nicht da.${grund ? `\n> ${grund}` : ''}`)
                .setFooter({ text: 'Bitte beim Sendeplan berücksichtigen' })
                .setTimestamp();
            const msg = await postTo(interaction.guild, config.CH.DIENSTPLAN, { embeds: [embed] });
            if (!msg) {
                return interaction.reply({ content: '❌ Dienstplan-Channel nicht gefunden — `DIENSTPLAN_CHANNEL_ID` in der .env prüfen.', ephemeral: true });
            }
            return interaction.reply({ content: '✅ Abwesenheit gemeldet — gute Erholung! 🏖️', ephemeral: true });
        },
    },

    // /idee
    {
        data: new SlashCommandBuilder().setName('idee').setDescription('Reiche eine Idee fürs Radio ein (Team)'),
        async execute(interaction) {
            if (!await requireTeam(interaction)) return;
            const modal = new ModalBuilder().setCustomId('team_idee_modal').setTitle('💡 Neue Idee');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('titel').setLabel('Kurztitel').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Deine Idee').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
            );
            await interaction.showModal(modal);
        },
    },

    // /bug
    {
        data: new SlashCommandBuilder().setName('bug').setDescription('Melde einen Bug oder ein technisches Problem (Team)'),
        async execute(interaction) {
            if (!await requireTeam(interaction)) return;
            const modal = new ModalBuilder().setCustomId('team_bug_modal').setTitle('🐛 Bug melden');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wo').setLabel('Wo tritt das Problem auf?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Was ist das Problem?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
            );
            await interaction.showModal(modal);
        },
    },
];

// Modals (team_idee_modal / team_bug_modal)
async function handleComponent(interaction) {
    const id = interaction.customId;

    if (interaction.isModalSubmit() && id === 'team_idee_modal') {
        const embed = brandEmbed(`💡 ${interaction.fields.getTextInputValue('titel')}`, config.COLORS.gold)
            .setDescription(interaction.fields.getTextInputValue('text'))
            .setFooter({ text: `Idee von ${interaction.user.tag} · 👍/👎 abstimmen!` })
            .setTimestamp();
        const msg = await postTo(interaction.guild, config.CH.IDEEN, { embeds: [embed] });
        if (!msg) {
            return interaction.reply({ content: '❌ Ideen-Channel nicht gefunden — `IDEEN_CHANNEL_ID` in der .env prüfen.', ephemeral: true });
        }
        await msg.react('👍').catch(() => {});
        await msg.react('👎').catch(() => {});
        return interaction.reply({ content: '✅ Danke für deine Idee! 💡', ephemeral: true });
    }

    if (interaction.isModalSubmit() && id === 'team_bug_modal') {
        const embed = brandEmbed('🐛 Neue Bug-Meldung', config.COLORS.red)
            .addFields(
                { name: 'Wo', value: interaction.fields.getTextInputValue('wo') },
                { name: 'Problem', value: interaction.fields.getTextInputValue('text') },
            )
            .setFooter({ text: `Gemeldet von ${interaction.user.tag}` })
            .setTimestamp();
        const msg = await postTo(interaction.guild, config.CH.BUGS, { embeds: [embed] });
        if (!msg) {
            return interaction.reply({ content: '❌ Bug-Channel nicht gefunden — `BUGS_CHANNEL_ID` in der .env prüfen.', ephemeral: true });
        }
        return interaction.reply({ content: '✅ Bug gemeldet — danke! 🔧', ephemeral: true });
    }
}

module.exports = { commands, handleComponent };
