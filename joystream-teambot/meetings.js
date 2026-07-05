// Team-Meetings: Einladung mit Zu-/Absage-Buttons und Protokoll.

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const config = require('./config');
const store = require('./store');
const { brandEmbed, requireTeam, postTo } = require('./util');

// Baut den Einladungs-Embed inkl. aktueller Zu-/Absagen
function meetingEmbed(m) {
    const liste = arr => (arr.length ? arr.map(id => `<@${id}>`).join(' ') : '_noch niemand_');
    return brandEmbed('📖 Team-Meeting')
        .setDescription(`## ${m.thema}\n🗓️ **${m.termin}**${m.ort ? `\n📍 ${m.ort}` : ''}`)
        .addFields(
            { name: `✅ Dabei (${m.ja.length})`, value: liste(m.ja) },
            { name: `❌ Kann nicht (${m.nein.length})`, value: liste(m.nein) },
            { name: `🤔 Vielleicht (${m.vielleicht.length})`, value: liste(m.vielleicht) },
        )
        .setFooter({ text: `Eingeladen von ${m.vonTag} · Bitte per Button antworten` });
}

function meetingButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('meet_ja').setLabel('Dabei').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('meet_nein').setLabel('Kann nicht').setEmoji('❌').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('meet_vielleicht').setLabel('Vielleicht').setEmoji('🤔').setStyle(ButtonStyle.Secondary),
    );
}

const commands = [
    // /meeting
    {
        data: new SlashCommandBuilder()
            .setName('meeting')
            .setDescription('Team-Meetings planen und protokollieren (Team)')
            .addSubcommand(s => s.setName('planen').setDescription('Lädt das Team zu einem Meeting ein')
                .addStringOption(o => o.setName('termin').setDescription('Wann? z. B. Freitag 19:00').setRequired(true).setMaxLength(80))
                .addStringOption(o => o.setName('thema').setDescription('Worum geht es?').setRequired(true).setMaxLength(120))
                .addStringOption(o => o.setName('ort').setDescription('Wo? z. B. Meeting Room (optional)').setMaxLength(80)))
            .addSubcommand(s => s.setName('protokoll').setDescription('Schreibt ein Protokoll ins Protokoll-Channel')),
        async execute(interaction) {
            if (!await requireTeam(interaction)) return;
            const sub = interaction.options.getSubcommand();

            if (sub === 'planen') {
                const meeting = {
                    thema:  interaction.options.getString('thema'),
                    termin: interaction.options.getString('termin'),
                    ort:    interaction.options.getString('ort') || null,
                    vonTag: interaction.user.tag,
                    ja: [], nein: [], vielleicht: [],
                };
                const msg = await postTo(interaction.guild, config.CH.MEETING_AGENDA, {
                    embeds: [meetingEmbed(meeting)],
                    components: [meetingButtons()],
                });
                if (!msg) {
                    return interaction.reply({ content: '❌ Agenda-Channel nicht gefunden — `MEETING_AGENDA_CHANNEL_ID` in der .env prüfen.', ephemeral: true });
                }
                store.addMeeting(msg.id, meeting);
                return interaction.reply({ content: `✅ Meeting-Einladung gepostet in ${msg.channel}.`, ephemeral: true });
            }

            if (sub === 'protokoll') {
                const modal = new ModalBuilder().setCustomId('meet_protokoll_modal').setTitle('Meeting-Protokoll');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thema').setLabel('Thema & Datum des Meetings').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inhalt').setLabel('Was wurde besprochen?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('beschluesse').setLabel('Beschlüsse / To-dos (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)),
                );
                return interaction.showModal(modal);
            }
        },
    },
];

// Buttons (meet_ja / meet_nein / meet_vielleicht) & Protokoll-Modal
async function handleComponent(interaction) {
    const id = interaction.customId;

    if (interaction.isButton() && ['meet_ja', 'meet_nein', 'meet_vielleicht'].includes(id)) {
        const m = store.getMeeting(interaction.message.id);
        if (!m) return interaction.reply({ content: '❌ Dieses Meeting kenne ich nicht mehr.', ephemeral: true });

        // User aus allen Listen entfernen, dann neu eintragen
        const uid = interaction.user.id;
        for (const key of ['ja', 'nein', 'vielleicht']) {
            m[key] = m[key].filter(x => x !== uid);
        }
        const ziel = id === 'meet_ja' ? 'ja' : id === 'meet_nein' ? 'nein' : 'vielleicht';
        m[ziel].push(uid);
        store.saveMeetings();

        return interaction.update({ embeds: [meetingEmbed(m)], components: [meetingButtons()] });
    }

    if (interaction.isModalSubmit() && id === 'meet_protokoll_modal') {
        const beschluesse = interaction.fields.getTextInputValue('beschluesse');
        const embed = brandEmbed('📝 Meeting-Protokoll')
            .setDescription(`## ${interaction.fields.getTextInputValue('thema')}`)
            .addFields({ name: 'Besprochen', value: interaction.fields.getTextInputValue('inhalt') })
            .setFooter({ text: `Protokoll von ${interaction.user.tag}` })
            .setTimestamp();
        if (beschluesse) embed.addFields({ name: '✅ Beschlüsse / To-dos', value: beschluesse });

        const msg = await postTo(interaction.guild, config.CH.MEETING_PROTOKOLL, { embeds: [embed] });
        if (!msg) {
            return interaction.reply({ content: '❌ Protokoll-Channel nicht gefunden — `MEETING_PROTOKOLL_CHANNEL_ID` in der .env prüfen.', ephemeral: true });
        }
        return interaction.reply({ content: `✅ Protokoll gespeichert in ${msg.channel}.`, ephemeral: true });
    }
}

module.exports = { commands, handleComponent };
