// Radio-Funktionen: Sendeplan verwalten & On-Air-Meldungen.

const { SlashCommandBuilder } = require('discord.js');
const config = require('./config');
const store = require('./store');
const { brandEmbed, requireTeam, postTo, isUhrzeit } = require('./util');

const TAGE = [
    { name: 'Montag',     value: 'Mo' },
    { name: 'Dienstag',   value: 'Di' },
    { name: 'Mittwoch',   value: 'Mi' },
    { name: 'Donnerstag', value: 'Do' },
    { name: 'Freitag',    value: 'Fr' },
    { name: 'Samstag',    value: 'Sa' },
    { name: 'Sonntag',    value: 'So' },
];

const TAG_LANG = Object.fromEntries(TAGE.map(t => [t.value, t.name]));

// Baut den Wochenplan-Embed aus dem Store
function sendeplanEmbed() {
    const plan = store.getSendeplan();
    const embed = brandEmbed('📻 Sendeplan der Woche')
        .setDescription('Alle Sendungen von **Joystream FM** auf einen Blick.')
        .setFooter({ text: `${config.BRAND.slogan} · Eintragen mit /sendeplan eintragen` });

    for (const t of TAGE) {
        const slots = plan[t.value];
        const value = slots.length
            ? slots.map(s => `🕒 **${s.von}–${s.bis}** · ${s.show} — <@${s.userId}>`).join('\n')
            : '_frei_';
        embed.addFields({ name: `${t.name}`, value });
    }
    return embed;
}

const commands = [
    // /sendeplan
    {
        data: new SlashCommandBuilder()
            .setName('sendeplan')
            .setDescription('Sendeplan anzeigen und verwalten (Team)')
            .addSubcommand(s => s.setName('anzeigen').setDescription('Zeigt den aktuellen Sendeplan'))
            .addSubcommand(s => s.setName('eintragen').setDescription('Trägt dich mit einer Sendung ein')
                .addStringOption(o => o.setName('tag').setDescription('Wochentag').setRequired(true).addChoices(...TAGE))
                .addStringOption(o => o.setName('von').setDescription('Startzeit, z. B. 18:00').setRequired(true))
                .addStringOption(o => o.setName('bis').setDescription('Endzeit, z. B. 20:00').setRequired(true))
                .addStringOption(o => o.setName('show').setDescription('Name der Sendung').setRequired(true).setMaxLength(80))
                .addUserOption(o => o.setName('dj').setDescription('Anderer DJ? (Standard: du selbst)')))
            .addSubcommand(s => s.setName('austragen').setDescription('Entfernt einen Slot aus dem Plan')
                .addStringOption(o => o.setName('tag').setDescription('Wochentag').setRequired(true).addChoices(...TAGE))
                .addStringOption(o => o.setName('von').setDescription('Startzeit des Slots, z. B. 18:00').setRequired(true)))
            .addSubcommand(s => s.setName('posten').setDescription('Postet den Wochenplan in den Sendeplan-Channel')),
        async execute(interaction) {
            if (!await requireTeam(interaction)) return;
            const sub = interaction.options.getSubcommand();

            if (sub === 'anzeigen') {
                return interaction.reply({ embeds: [sendeplanEmbed()], ephemeral: true });
            }

            if (sub === 'eintragen') {
                const tag = interaction.options.getString('tag');
                const von = interaction.options.getString('von').trim();
                const bis = interaction.options.getString('bis').trim();
                const show = interaction.options.getString('show');
                const dj = interaction.options.getUser('dj') || interaction.user;
                if (!isUhrzeit(von) || !isUhrzeit(bis)) {
                    return interaction.reply({ content: '❌ Bitte Uhrzeiten im Format `HH:MM` angeben, z. B. `18:00`.', ephemeral: true });
                }
                const belegt = store.getSendeplan()[tag].find(s => s.von === von);
                if (belegt) {
                    return interaction.reply({ content: `❌ ${TAG_LANG[tag]} ${von} ist schon belegt: **${belegt.show}** (<@${belegt.userId}>). Erst mit \`/sendeplan austragen\` freigeben.`, ephemeral: true });
                }
                store.addSlot(tag, { von, bis, show, userId: dj.id });
                return interaction.reply({ content: `✅ Eingetragen: **${show}** am **${TAG_LANG[tag]} ${von}–${bis}** mit ${dj}. 🎧`, ephemeral: true });
            }

            if (sub === 'austragen') {
                const tag = interaction.options.getString('tag');
                const von = interaction.options.getString('von').trim();
                const slot = store.removeSlot(tag, von);
                if (!slot) {
                    return interaction.reply({ content: `❌ Am ${TAG_LANG[tag]} um ${von} ist kein Slot eingetragen.`, ephemeral: true });
                }
                return interaction.reply({ content: `🗑️ Entfernt: **${slot.show}** (${TAG_LANG[tag]} ${slot.von}–${slot.bis}).`, ephemeral: true });
            }

            if (sub === 'posten') {
                const msg = await postTo(interaction.guild, config.CH.SENDEPLAN, { embeds: [sendeplanEmbed()] });
                if (!msg) {
                    return interaction.reply({ content: '❌ Sendeplan-Channel nicht gefunden — `SENDEPLAN_CHANNEL_ID` in der .env prüfen.', ephemeral: true });
                }
                return interaction.reply({ content: `✅ Sendeplan gepostet in ${msg.channel}.`, ephemeral: true });
            }
        },
    },

    // /onair
    {
        data: new SlashCommandBuilder()
            .setName('onair')
            .setDescription('Meldet Start und Ende deiner Sendung (Team)')
            .addSubcommand(s => s.setName('start').setDescription('Sendung starten — postet in „jetzt läuft“')
                .addStringOption(o => o.setName('show').setDescription('Name der Sendung').setRequired(true).setMaxLength(80))
                .addStringOption(o => o.setName('info').setDescription('Worum geht es heute? (optional)').setMaxLength(200)))
            .addSubcommand(s => s.setName('ende').setDescription('Sendung beenden')),
        async execute(interaction) {
            if (!await requireTeam(interaction)) return;
            const sub = interaction.options.getSubcommand();

            if (sub === 'start') {
                const laufend = store.getOnair();
                if (laufend) {
                    return interaction.reply({ content: `❌ Es läuft schon eine Sendung: **${laufend.show}** mit <@${laufend.djId}>. Erst \`/onair ende\`.`, ephemeral: true });
                }
                const show = interaction.options.getString('show');
                const info = interaction.options.getString('info');
                store.setOnair({ show, djId: interaction.user.id, seit: Date.now() });

                const embed = brandEmbed('🔴 ON AIR — Jetzt läuft!', config.COLORS.live)
                    .setDescription(`## ${show}\nmit ${interaction.user}${info ? `\n\n> ${info}` : ''}`)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setTimestamp();
                await postTo(interaction.guild, config.CH.JETZT_LAEUFT, { embeds: [embed] });

                interaction.client.user.setActivity(`🔴 LIVE: ${show}`);
                return interaction.reply({ content: `🔴 Du bist ON AIR mit **${show}**! Viel Spaß! 🎧`, ephemeral: true });
            }

            if (sub === 'ende') {
                const laufend = store.getOnair();
                if (!laufend) {
                    return interaction.reply({ content: '❌ Gerade läuft keine Sendung.', ephemeral: true });
                }
                store.setOnair(null);
                const minuten = Math.max(1, Math.round((Date.now() - laufend.seit) / 60000));
                const embed = brandEmbed('⚫ Sendung beendet', config.COLORS.red)
                    .setDescription(`**${laufend.show}** mit <@${laufend.djId}> ist vorbei — danke fürs Zuhören! 💜\n_Sendezeit: ca. ${minuten} Minuten_`)
                    .setTimestamp();
                await postTo(interaction.guild, config.CH.JETZT_LAEUFT, { embeds: [embed] });

                interaction.client.user.setActivity(`${config.BRAND.name} 📻 | /teamhelp`);
                return interaction.reply({ content: `✅ **${laufend.show}** beendet. Gute Sendung! 🎉`, ephemeral: true });
            }
        },
    },
];

module.exports = { commands };
