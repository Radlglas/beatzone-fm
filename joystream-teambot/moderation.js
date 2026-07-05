// Team-Verwaltung: Warns, Notizen, Timeout, Kick, Ban — mit Modlog.

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config');
const store = require('./store');
const { brandEmbed, requireMod, isMod, postTo } = require('./util');

// Modlog-Embed bauen und posten + im Store sichern
async function log(interaction, { action, target, reason, color, emoji }) {
    store.logAction({
        action, targetId: target.id, targetTag: target.tag ?? target.user?.tag ?? String(target),
        modId: interaction.user.id, modTag: interaction.user.tag, reason: reason || null,
    });
    const embed = brandEmbed(`${emoji} ${action}`, color)
        .addFields(
            { name: 'User', value: `<@${target.id}> \`${target.id}\``, inline: true },
            { name: 'Mod', value: `${interaction.user}`, inline: true },
            { name: 'Grund', value: reason || '_kein Grund angegeben_' },
        )
        .setTimestamp();
    await postTo(interaction.guild, config.CH.MODLOG, { embeds: [embed] });
}

// "10m", "1h", "1d" → Minuten (für Timeout; Discord-Limit 28 Tage)
function parseMinutes(input) {
    const m = String(input).trim().match(/^(\d+)\s*(m|min|h|std|d|tag)?$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const u = (m[2] || 'm').toLowerCase();
    const mins = u.startsWith('h') || u.startsWith('std') ? n * 60
        : u.startsWith('d') || u.startsWith('tag') ? n * 1440
        : n;
    if (mins < 1 || mins > 28 * 1440) return null;
    return mins;
}

const commands = [
    // /warn
    {
        data: new SlashCommandBuilder()
            .setName('warn').setDescription('Verwarnt einen User (Team/Mod)')
            .addUserOption(o => o.setName('user').setDescription('Wer wird verwarnt?').setRequired(true))
            .addStringOption(o => o.setName('grund').setDescription('Grund der Verwarnung').setRequired(true).setMaxLength(400)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const grund = interaction.options.getString('grund');
            if (user.bot) return interaction.reply({ content: '❌ Bots kann man nicht verwarnen.', ephemeral: true });

            const entry = store.addWarn(user.id, { reason: grund, modId: interaction.user.id, modTag: interaction.user.tag });
            const total = store.getWarns(user.id).length;

            await user.send(`⚠️ Du wurdest auf **${interaction.guild.name}** verwarnt.\n**Grund:** ${grund}\nDu hast jetzt **${total}** Verwarnung(en).`).catch(() => {});
            await log(interaction, { action: 'Warn', target: user, reason: grund, color: config.COLORS.gold, emoji: '⚠️' });

            const embed = brandEmbed('⚠️ Verwarnung ausgesprochen', config.COLORS.gold)
                .setDescription(`${user} wurde verwarnt.`)
                .addFields(
                    { name: 'Grund', value: grund },
                    { name: 'Warn-ID', value: `#${entry.id}`, inline: true },
                    { name: 'Gesamt', value: `${total} Verwarnung(en)`, inline: true },
                );
            await interaction.reply({ embeds: [embed] });
        },
    },

    // /warns
    {
        data: new SlashCommandBuilder()
            .setName('warns').setDescription('Zeigt die Verwarnungen eines Users (Team/Mod)')
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const list = store.getWarns(user.id);
            const embed = brandEmbed(`⚠️ Verwarnungen von ${user.tag}`, config.COLORS.gold)
                .setThumbnail(user.displayAvatarURL())
                .setDescription(list.length
                    ? list.map(w => `**#${w.id}** · <t:${Math.floor(w.ts / 1000)}:d> · von <@${w.modId}>\n> ${w.reason}`).join('\n\n')
                    : '✅ Dieser User hat keine Verwarnungen.')
                .setFooter({ text: `${list.length} Verwarnung(en) · /unwarn zum Entfernen` });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        },
    },

    // /unwarn
    {
        data: new SlashCommandBuilder()
            .setName('unwarn').setDescription('Entfernt eine bestimmte Verwarnung (Team/Mod)')
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true))
            .addIntegerOption(o => o.setName('id').setDescription('Warn-ID (siehe /warns)').setRequired(true)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const id = interaction.options.getInteger('id');
            const removed = store.removeWarn(user.id, id);
            if (!removed) return interaction.reply({ content: `❌ Keine Verwarnung mit ID #${id} bei ${user.tag} gefunden.`, ephemeral: true });
            await log(interaction, { action: 'Unwarn', target: user, reason: `Warn #${id} entfernt`, color: config.COLORS.green, emoji: '✅' });
            await interaction.reply({ content: `✅ Verwarnung **#${id}** von ${user} entfernt.` });
        },
    },

    // /clearwarns
    {
        data: new SlashCommandBuilder()
            .setName('clearwarns').setDescription('Löscht ALLE Verwarnungen eines Users (Team/Mod)')
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const count = store.clearWarns(user.id);
            if (!count) return interaction.reply({ content: `ℹ️ ${user.tag} hatte keine Verwarnungen.`, ephemeral: true });
            await log(interaction, { action: 'Warns gelöscht', target: user, reason: `${count} Verwarnung(en)`, color: config.COLORS.green, emoji: '🧹' });
            await interaction.reply({ content: `🧹 Alle **${count}** Verwarnungen von ${user} gelöscht.` });
        },
    },

    // /note
    {
        data: new SlashCommandBuilder()
            .setName('note').setDescription('Interne Team-Notiz zu einem User (Team/Mod)')
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true))
            .addStringOption(o => o.setName('text').setDescription('Notiztext').setRequired(true).setMaxLength(400)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const text = interaction.options.getString('text');
            const entry = store.addNote(user.id, { text, modId: interaction.user.id, modTag: interaction.user.tag });
            await interaction.reply({ content: `📝 Notiz **#${entry.id}** zu ${user} gespeichert (nur fürs Team sichtbar).`, ephemeral: true });
        },
    },

    // /notes
    {
        data: new SlashCommandBuilder()
            .setName('notes').setDescription('Zeigt interne Notizen zu einem User (Team/Mod)')
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const list = store.getNotes(user.id);
            const embed = brandEmbed(`📝 Notizen zu ${user.tag}`)
                .setDescription(list.length
                    ? list.map(n => `**#${n.id}** · <t:${Math.floor(n.ts / 1000)}:d> · <@${n.modId}>\n> ${n.text}`).join('\n\n')
                    : 'Keine Notizen vorhanden.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        },
    },

    // /timeout
    {
        data: new SlashCommandBuilder()
            .setName('timeout').setDescription('Schaltet einen User stumm (Timeout) (Team/Mod)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true))
            .addStringOption(o => o.setName('dauer').setDescription('z. B. 10m, 1h, 1d (max 28d)').setRequired(true))
            .addStringOption(o => o.setName('grund').setDescription('Grund (optional)').setMaxLength(400)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const grund = interaction.options.getString('grund');
            const mins = parseMinutes(interaction.options.getString('dauer'));
            if (mins === null) return interaction.reply({ content: '❌ Ungültige Dauer. Beispiele: `10m`, `1h`, `1d` (max 28 Tage).', ephemeral: true });
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ User ist nicht auf dem Server.', ephemeral: true });
            if (!member.moderatable) return interaction.reply({ content: '❌ Ich kann diesen User nicht timeouten (Rolle zu hoch / fehlende Rechte).', ephemeral: true });

            await member.timeout(mins * 60000, grund || undefined);
            await log(interaction, { action: `Timeout (${mins} Min.)`, target: user, reason: grund, color: config.COLORS.red, emoji: '🔇' });
            await interaction.reply({ content: `🔇 ${user} wurde für **${mins} Minuten** stummgeschaltet.` });
        },
    },

    // /untimeout
    {
        data: new SlashCommandBuilder()
            .setName('untimeout').setDescription('Hebt einen Timeout auf (Team/Mod)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ User ist nicht auf dem Server.', ephemeral: true });
            await member.timeout(null).catch(() => {});
            await log(interaction, { action: 'Timeout aufgehoben', target: user, reason: null, color: config.COLORS.green, emoji: '🔊' });
            await interaction.reply({ content: `🔊 Timeout von ${user} aufgehoben.` });
        },
    },

    // /kick
    {
        data: new SlashCommandBuilder()
            .setName('kick').setDescription('Kickt einen User vom Server (Team/Mod)')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true))
            .addStringOption(o => o.setName('grund').setDescription('Grund').setMaxLength(400)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const grund = interaction.options.getString('grund');
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ User ist nicht auf dem Server.', ephemeral: true });
            if (!member.kickable) return interaction.reply({ content: '❌ Ich kann diesen User nicht kicken (Rolle zu hoch / fehlende Rechte).', ephemeral: true });

            await user.send(`👢 Du wurdest von **${interaction.guild.name}** gekickt.${grund ? `\n**Grund:** ${grund}` : ''}`).catch(() => {});
            await member.kick(grund || undefined);
            await log(interaction, { action: 'Kick', target: user, reason: grund, color: config.COLORS.red, emoji: '👢' });
            await interaction.reply({ content: `👢 ${user.tag} wurde gekickt.` });
        },
    },

    // /ban
    {
        data: new SlashCommandBuilder()
            .setName('ban').setDescription('Bannt einen User vom Server (Team/Mod)')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addUserOption(o => o.setName('user').setDescription('Welcher User?').setRequired(true))
            .addStringOption(o => o.setName('grund').setDescription('Grund').setMaxLength(400)),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const user = interaction.options.getUser('user');
            const grund = interaction.options.getString('grund');
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (member && !member.bannable) return interaction.reply({ content: '❌ Ich kann diesen User nicht bannen (Rolle zu hoch / fehlende Rechte).', ephemeral: true });

            await user.send(`🔨 Du wurdest von **${interaction.guild.name}** gebannt.${grund ? `\n**Grund:** ${grund}` : ''}`).catch(() => {});
            await interaction.guild.members.ban(user.id, { reason: grund || undefined });
            await log(interaction, { action: 'Ban', target: user, reason: grund, color: config.COLORS.red, emoji: '🔨' });
            await interaction.reply({ content: `🔨 ${user.tag} wurde gebannt.` });
        },
    },

    // /modlog
    {
        data: new SlashCommandBuilder()
            .setName('modlog').setDescription('Zeigt die letzten Mod-Aktionen (Team/Mod)'),
        async execute(interaction) {
            if (!await requireMod(interaction)) return;
            const log = store.getModlog(15);
            const embed = brandEmbed('🗂️ Modlog — letzte Aktionen')
                .setDescription(log.length
                    ? log.map(e => `<t:${Math.floor(e.ts / 1000)}:R> · **${e.action}** — <@${e.targetId}> von <@${e.modId}>${e.reason ? `\n> ${e.reason}` : ''}`).join('\n\n')
                    : 'Noch keine Aktionen protokolliert.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        },
    },
];

module.exports = { commands };
