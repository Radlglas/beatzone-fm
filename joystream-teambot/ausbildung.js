// Ausbildung: Aufgaben an Azubis vergeben und abhaken.

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const config = require('./config');
const store = require('./store');
const { brandEmbed, isTeam, requireTeam, postTo } = require('./util');

function aufgabeEmbed(a) {
    const embed = brandEmbed(`📄 Aufgabe #${a.id}: ${a.titel}`, a.done ? config.COLORS.green : config.COLORS.primary)
        .setDescription(a.beschreibung || '_Keine weitere Beschreibung._')
        .addFields(
            { name: '🎓 Azubi', value: `<@${a.azubiId}>`, inline: true },
            { name: '⏰ Deadline', value: a.deadline || 'keine', inline: true },
            { name: 'Status', value: a.done ? '✅ Erledigt' : '🔄 Offen', inline: true },
        )
        .setFooter({ text: `Vergeben von ${a.vonTag}` })
        .setTimestamp();
    return embed;
}

function aufgabeButtons(a) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`azubi_done_${a.id}`)
            .setLabel('Erledigt')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!!a.done),
    );
}

const commands = [
    // /aufgabe
    {
        data: new SlashCommandBuilder()
            .setName('aufgabe')
            .setDescription('Ausbildungs-Aufgaben verwalten (Team)')
            .addSubcommand(s => s.setName('erstellen').setDescription('Vergibt eine Aufgabe an einen Azubi')
                .addUserOption(o => o.setName('azubi').setDescription('Wer soll die Aufgabe machen?').setRequired(true))
                .addStringOption(o => o.setName('titel').setDescription('Kurztitel der Aufgabe').setRequired(true).setMaxLength(80))
                .addStringOption(o => o.setName('beschreibung').setDescription('Was genau ist zu tun? (optional)').setMaxLength(500))
                .addStringOption(o => o.setName('deadline').setDescription('Bis wann? z. B. Sonntag (optional)').setMaxLength(60)))
            .addSubcommand(s => s.setName('liste').setDescription('Zeigt alle offenen Aufgaben')),
        async execute(interaction) {
            if (!await requireTeam(interaction)) return;
            const sub = interaction.options.getSubcommand();

            if (sub === 'erstellen') {
                const azubi = interaction.options.getUser('azubi');
                const aufgabe = {
                    id: store.nextAufgabenNr(),
                    azubiId: azubi.id,
                    titel: interaction.options.getString('titel'),
                    beschreibung: interaction.options.getString('beschreibung') || null,
                    deadline: interaction.options.getString('deadline') || null,
                    vonTag: interaction.user.tag,
                    done: false,
                };
                const msg = await postTo(interaction.guild, config.CH.AUFGABEN, {
                    content: `${azubi} — neue Aufgabe für dich! 🎓`,
                    embeds: [aufgabeEmbed(aufgabe)],
                    components: [aufgabeButtons(aufgabe)],
                });
                if (!msg) {
                    return interaction.reply({ content: '❌ Aufgaben-Channel nicht gefunden — `AUFGABEN_CHANNEL_ID` in der .env prüfen.', ephemeral: true });
                }
                store.addAufgabe(aufgabe);
                return interaction.reply({ content: `✅ Aufgabe **#${aufgabe.id}** an ${azubi} vergeben.`, ephemeral: true });
            }

            if (sub === 'liste') {
                const offen = store.offeneAufgaben();
                const embed = brandEmbed('📄 Offene Ausbildungs-Aufgaben')
                    .setDescription(offen.length
                        ? offen.map(a => `**#${a.id}** ${a.titel} — <@${a.azubiId}>${a.deadline ? ` · ⏰ ${a.deadline}` : ''}`).join('\n')
                        : '🎉 Keine offenen Aufgaben — alles erledigt!');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        },
    },
];

// Button: azubi_done_<id>
async function handleComponent(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('azubi_done_')) return;

    const id = Number(interaction.customId.slice('azubi_done_'.length));
    const a = store.getAufgabe(id);
    if (!a) return interaction.reply({ content: '❌ Diese Aufgabe kenne ich nicht mehr.', ephemeral: true });
    if (a.done) return interaction.reply({ content: '✅ Die ist schon erledigt.', ephemeral: true });

    // Nur der Azubi selbst oder ein Team-Mitglied darf abhaken
    if (interaction.user.id !== a.azubiId && !isTeam(interaction.member)) {
        return interaction.reply({ content: '🔒 Nur der/die Azubi selbst (oder das Team) kann diese Aufgabe abhaken.', ephemeral: true });
    }

    store.updateAufgabe(id, { done: true, doneAt: Date.now() });
    await interaction.update({ embeds: [aufgabeEmbed(a)], components: [aufgabeButtons(a)] });

    // Erfolg in den Fortschritts-Channel posten
    const embed = brandEmbed('📈 Aufgabe erledigt!', config.COLORS.green)
        .setDescription(`<@${a.azubiId}> hat **Aufgabe #${a.id}: ${a.titel}** abgeschlossen. Stark! 💪`)
        .setTimestamp();
    await postTo(interaction.guild, config.CH.FORTSCHRITT, { embeds: [embed] });
}

module.exports = { commands, handleComponent };
