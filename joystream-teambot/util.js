// Kleine Helfer, die mehrere Module brauchen.

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config');

// Standard-Embed im Joystream-Look
function brandEmbed(title, color = config.COLORS.primary) {
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${config.BRAND.name} 📻` })
        .setTitle(title);
}

// Hat das Mitglied eine Team-Rolle (oder Admin-Rechte)?
function isTeam(member) {
    if (!member) return false;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    return config.TEAM_ROLES.some(id => member.roles.cache.has(id));
}

// Antwortet mit einer freundlichen Absage, wenn kein Team-Mitglied
async function requireTeam(interaction) {
    if (isTeam(interaction.member)) return true;
    await interaction.reply({ content: '🔒 Dieser Befehl ist nur fürs Team.', ephemeral: true });
    return false;
}

// Darf moderieren? (Team ODER passende Discord-Rechte)
function isMod(member) {
    if (!member) return false;
    if (isTeam(member)) return true;
    return member.permissions?.has(PermissionFlagsBits.ModerateMembers)
        || member.permissions?.has(PermissionFlagsBits.KickMembers)
        || member.permissions?.has(PermissionFlagsBits.BanMembers);
}

async function requireMod(interaction) {
    if (isMod(interaction.member)) return true;
    await interaction.reply({ content: '🔒 Dafür brauchst du Mod- oder Team-Rechte.', ephemeral: true });
    return false;
}

// Embed in einen Channel posten (still scheitern, wenn nicht konfiguriert)
async function postTo(guild, channelId, payload) {
    if (!channelId || !guild) return null;
    const ch = guild.channels.cache.get(channelId);
    if (!ch) return null;
    return ch.send(payload).catch(() => null);
}

// "HH:MM" prüfen (z. B. 09:00, 20:30)
function isUhrzeit(s) {
    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(s).trim());
}

module.exports = { brandEmbed, isTeam, requireTeam, isMod, requireMod, postTo, isUhrzeit };
