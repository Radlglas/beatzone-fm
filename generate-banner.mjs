// Discord Banner Generator — Minecraft Allianz Bot
// 1200x400px dark purple aesthetic with Pillow-quality rendering via @napi-rs/canvas

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Font registration ──────────────────────────────────────────────────────────
const FONTS_DIR = 'C:\\Users\\jploe\\.claude\\plugins\\cache\\anthropic-agent-skills\\document-skills\\f458cee31a75\\skills\\canvas-design\\canvas-fonts';

// Tektur = blocky/pixel-adjacent display font → perfect for Minecraft
GlobalFonts.registerFromPath(join(FONTS_DIR, 'Tektur-Medium.ttf'), 'Tektur');
GlobalFonts.registerFromPath(join(FONTS_DIR, 'Tektur-Regular.ttf'), 'TekturReg');
// PixelifySans = genuine pixel font for accent text
GlobalFonts.registerFromPath(join(FONTS_DIR, 'PixelifySans-Medium.ttf'), 'Pixelify');
// Silkscreen = ultra-clean pixel/bitmap font
GlobalFonts.registerFromPath(join(FONTS_DIR, 'Silkscreen-Regular.ttf'), 'Silkscreen');
// GeistMono for small labels
GlobalFonts.registerFromPath(join(FONTS_DIR, 'GeistMono-Regular.ttf'), 'GeistMono');

// ── Canvas setup ───────────────────────────────────────────────────────────────
const W = 1200;
const H = 400;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// ── Color palette ──────────────────────────────────────────────────────────────
const C = {
  nearBlack:  '#0D0010',
  deepPurple: '#6B0AC9',
  brightPurple:'#9B30FF',
  midPurple:  '#7B1FE8',
  lavender:   '#C084FC',
  paleLavender:'#E9D5FF',
  white:      '#FFFFFF',
  fogPurple:  'rgba(155,48,255,0.08)',
  glowWhite:  'rgba(255,255,255,0.9)',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return {r,g,b};
}
function rgba(hex, a) {
  const {r,g,b} = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Seeded pseudo-random for deterministic particles ──────────────────────────
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
const rng = seededRandom(42);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. BACKGROUND — deep near-black with radial purple warmth
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Base fill
  ctx.fillStyle = C.nearBlack;
  ctx.fillRect(0, 0, W, H);

  // Deep background glow — right side where text lives
  const bg1 = ctx.createRadialGradient(850, 180, 0, 850, 180, 500);
  bg1.addColorStop(0, rgba('#6B0AC9', 0.35));
  bg1.addColorStop(0.5, rgba('#3A0070', 0.18));
  bg1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg1;
  ctx.fillRect(0, 0, W, H);

  // Left side glow — character zone
  const bg2 = ctx.createRadialGradient(180, 200, 0, 180, 200, 320);
  bg2.addColorStop(0, rgba('#9B30FF', 0.20));
  bg2.addColorStop(0.6, rgba('#4B0092', 0.10));
  bg2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg2;
  ctx.fillRect(0, 0, W, H);

  // Subtle top-left corner dark vignette
  const vignette = ctx.createRadialGradient(W*0.5, H*0.5, H*0.3, W*0.5, H*0.5, H*1.2);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GLOWING ORB / MOON — upper-left area
// ═══════════════════════════════════════════════════════════════════════════════
{
  const ox = 195, oy = 148, or_ = 82;

  // Outer halo layers (wide, very soft)
  for (const [rad, alpha] of [[260, 0.04],[200, 0.07],[150, 0.11],[110, 0.15]]) {
    const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, rad);
    halo.addColorStop(0, rgba('#9B30FF', alpha));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
  }

  // Orb body — white hot center fading to deep purple
  const orb = ctx.createRadialGradient(ox - 12, oy - 12, 4, ox, oy, or_);
  orb.addColorStop(0.00, 'rgba(255,255,255,0.98)');
  orb.addColorStop(0.18, 'rgba(240,220,255,0.90)');
  orb.addColorStop(0.45, rgba('#C084FC', 0.75));
  orb.addColorStop(0.75, rgba('#7B1FE8', 0.55));
  orb.addColorStop(1.00, rgba('#3A0070', 0.20));
  ctx.beginPath();
  ctx.arc(ox, oy, or_, 0, Math.PI * 2);
  ctx.fillStyle = orb;
  ctx.fill();

  // Crisp inner rim highlight
  const rim = ctx.createRadialGradient(ox - 20, oy - 22, 2, ox, oy, or_);
  rim.addColorStop(0, 'rgba(255,255,255,0.35)');
  rim.addColorStop(0.3, 'rgba(255,255,255,0.08)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(ox, oy, or_, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  // Subtle "crater" ring texture — evokes the moon
  ctx.save();
  ctx.beginPath();
  ctx.arc(ox, oy, or_, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(180,130,255,0.12)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const cx2 = ox + (rng() - 0.5) * or_ * 1.2;
    const cy2 = oy + (rng() - 0.5) * or_ * 1.2;
    const cr  = 8 + rng() * 22;
    ctx.beginPath();
    ctx.arc(cx2, cy2, cr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CHARACTER SILHOUETTE ZONE — left side aura columns
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Vertical aura shafts suggesting a standing figure
  const shafts = [
    {x: 105, w: 28, alpha: 0.12},
    {x: 185, w: 18, alpha: 0.09},
    {x: 255, w: 12, alpha: 0.06},
  ];
  for (const s of shafts) {
    const sg = ctx.createLinearGradient(s.x, 60, s.x, H - 60);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(0.2, rgba('#9B30FF', s.alpha));
    sg.addColorStop(0.5, rgba('#C084FC', s.alpha * 1.4));
    sg.addColorStop(0.8, rgba('#9B30FF', s.alpha));
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(s.x - s.w/2, 0, s.w, H);
  }

  // Character silhouette — blocky Minecraft-style
  // Drawn as flat dark purple shape with bright purple edge glow
  const charX = 115, charBaseY = 340;

  // Glow aura around character
  const charGlow = ctx.createRadialGradient(charX, charBaseY - 90, 10, charX, charBaseY - 90, 130);
  charGlow.addColorStop(0, rgba('#9B30FF', 0.22));
  charGlow.addColorStop(0.5, rgba('#6B0AC9', 0.12));
  charGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = charGlow;
  ctx.fillRect(0, charBaseY - 220, 260, 280);

  // Helper: draw blocky Minecraft body part
  function drawBlock(x, y, w, h, fillColor, strokeColor) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    }
  }

  // -- Silhouette (Minecraft Steve proportions, ~170px tall) --
  const scale = 1.0;
  const bw = 40 * scale; // body width
  const bx = charX - bw / 2;

  // Shadow beneath character
  const shadowG = ctx.createRadialGradient(charX, charBaseY, 0, charX, charBaseY, 55);
  shadowG.addColorStop(0, rgba('#9B30FF', 0.30));
  shadowG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowG;
  ctx.fillRect(charX - 55, charBaseY - 8, 110, 20);

  const bodyColor   = rgba('#1A0035', 0.88);
  const edgeGlow    = rgba('#9B30FF', 0.70);
  const armorAccent = rgba('#6B0AC9', 0.55);

  // Legs
  drawBlock(bx,            charBaseY - 80*scale, bw/2 - 2, 80*scale, bodyColor, edgeGlow);
  drawBlock(bx + bw/2 + 2, charBaseY - 80*scale, bw/2 - 2, 80*scale, bodyColor, edgeGlow);

  // Body
  drawBlock(bx, charBaseY - 80*scale - 100*scale, bw, 100*scale, bodyColor, edgeGlow);

  // Arm left (extended slightly)
  drawBlock(bx - 22*scale, charBaseY - 80*scale - 95*scale, 20*scale, 90*scale, bodyColor, edgeGlow);

  // Arm right
  drawBlock(bx + bw + 2*scale, charBaseY - 80*scale - 95*scale, 20*scale, 90*scale, bodyColor, edgeGlow);

  // Head
  const headSize = 44 * scale;
  drawBlock(bx - 2, charBaseY - 80*scale - 100*scale - headSize - 2, headSize + 4, headSize, bodyColor, edgeGlow);

  // Eye glow slots
  const eyeY = charBaseY - 80*scale - 100*scale - headSize + 10;
  ctx.fillStyle = rgba('#C084FC', 0.80);
  ctx.fillRect(bx + 6, eyeY, 10, 8);
  ctx.fillRect(bx + 24, eyeY, 10, 8);

  // Armor pixel detail strips
  ctx.fillStyle = armorAccent;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(bx + 4, charBaseY - 80*scale - 80*scale + i * 28, bw - 8, 6);
  }

  // Edge-glow repass — draw glowing outlines over silhouette for aura effect
  ctx.shadowColor = '#9B30FF';
  ctx.shadowBlur  = 18;
  ctx.strokeStyle = rgba('#9B30FF', 0.5);
  ctx.lineWidth   = 1.5;
  // Re-stroke body outline for glow effect
  ctx.strokeRect(bx, charBaseY - 80*scale - 100*scale, bw, 100*scale);
  ctx.strokeRect(bx - 2, charBaseY - 80*scale - 100*scale - headSize - 2, headSize + 4, headSize);
  ctx.shadowBlur = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MINECRAFT BLOCK GRID TEXTURE — subtle background pattern, right half
// ═══════════════════════════════════════════════════════════════════════════════
{
  const tileSize = 32;
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#9B30FF';
  ctx.lineWidth = 0.5;
  for (let x = 300; x < W; x += tileSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += tileSize) {
    ctx.beginPath(); ctx.moveTo(300, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PARTICLE / SPARKLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
{
  const rng2 = seededRandom(77);

  // Large soft bokeh glows
  for (let i = 0; i < 22; i++) {
    const px = 300 + rng2() * 880;
    const py = rng2() * H;
    const pr = 3 + rng2() * 18;
    const alpha = 0.04 + rng2() * 0.12;
    const colorChoice = rng2() > 0.5 ? '#9B30FF' : '#C084FC';
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, rgba(colorChoice, alpha * 2.5));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  // Crisp 4-point star sparkles
  function drawSparkle(x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = size * 4;
    // 4-pointed star — two diamond passes rotated 45deg
    for (let rot = 0; rot < 2; rot++) {
      ctx.save();
      ctx.rotate(rot * Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.16, -size * 0.16);
      ctx.lineTo(size, 0);
      ctx.lineTo(size * 0.16, size * 0.16);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.16, size * 0.16);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.16, -size * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Central bright dot
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = alpha * 1.2;
    ctx.fill();
    ctx.restore();
  }

  const rng3 = seededRandom(113);
  const sparkleColors = ['#FFFFFF', '#C084FC', '#9B30FF', '#E9D5FF'];
  for (let i = 0; i < 38; i++) {
    const sx = 280 + rng3() * (W - 280);
    const sy = rng3() * H;
    const ss = 1 + rng3() * 5;
    const sc = sparkleColors[Math.floor(rng3() * sparkleColors.length)];
    const sa = 0.3 + rng3() * 0.65;
    drawSparkle(sx, sy, ss, sc, sa);
  }

  // A few left-side sparkles (near character)
  const rng4 = seededRandom(200);
  for (let i = 0; i < 12; i++) {
    const sx = 20 + rng4() * 260;
    const sy = rng4() * H;
    const ss = 0.8 + rng4() * 3;
    const sa = 0.2 + rng4() * 0.5;
    drawSparkle(sx, sy, ss, '#9B30FF', sa);
  }

  // Floating square "pixel dust" — Minecraft flavour
  const rng5 = seededRandom(303);
  for (let i = 0; i < 55; i++) {
    const px = 290 + rng5() * 880;
    const py = 10 + rng5() * (H - 20);
    const ps = 1.5 + rng5() * 3.5;
    const pa = 0.08 + rng5() * 0.25;
    const pc = rng5() > 0.6 ? '#9B30FF' : (rng5() > 0.3 ? '#C084FC' : '#FFFFFF');
    ctx.fillStyle = pc.startsWith('#') ? rgba(pc, pa) : pc;
    ctx.save();
    ctx.globalAlpha = pa;
    ctx.fillStyle = pc;
    ctx.fillRect(px, py, ps, ps);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PURPLE FOG / MIST AT BOTTOM
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Main fog bank
  const fog1 = ctx.createLinearGradient(0, H - 120, 0, H);
  fog1.addColorStop(0, 'rgba(0,0,0,0)');
  fog1.addColorStop(0.4, rgba('#6B0AC9', 0.08));
  fog1.addColorStop(0.7, rgba('#9B30FF', 0.14));
  fog1.addColorStop(1,   rgba('#3A0050', 0.55));
  ctx.fillStyle = fog1;
  ctx.fillRect(0, H - 120, W, 120);

  // Second wispy layer — horizontal radial wisps
  const rng6 = seededRandom(404);
  for (let i = 0; i < 6; i++) {
    const wx = 80 + rng6() * (W - 160);
    const wy = H - 50 + rng6() * 30;
    const wr = 120 + rng6() * 180;
    const wa = 0.06 + rng6() * 0.10;
    const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
    wg.addColorStop(0, rgba('#9B30FF', wa));
    wg.addColorStop(0.6, rgba('#6B0AC9', wa * 0.5));
    wg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
  }

  // Bottom edge hard-darkened strip
  const bottomEdge = ctx.createLinearGradient(0, H - 22, 0, H);
  bottomEdge.addColorStop(0, 'rgba(0,0,0,0)');
  bottomEdge.addColorStop(1, 'rgba(0,0,16,0.75)');
  ctx.fillStyle = bottomEdge;
  ctx.fillRect(0, H - 22, W, 22);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. HORIZONTAL DIVIDER LINE — thin glowing purple
// ═══════════════════════════════════════════════════════════════════════════════
{
  const lineY = H - 10;
  ctx.save();
  ctx.shadowColor = '#9B30FF';
  ctx.shadowBlur = 10;
  const lg = ctx.createLinearGradient(280, 0, W - 30, 0);
  lg.addColorStop(0, 'rgba(155,48,255,0)');
  lg.addColorStop(0.1, 'rgba(155,48,255,0.8)');
  lg.addColorStop(0.9, 'rgba(155,48,255,0.8)');
  lg.addColorStop(1, 'rgba(155,48,255,0)');
  ctx.strokeStyle = lg;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(280, lineY);
  ctx.lineTo(W - 30, lineY);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. MAIN TITLE TEXT — "Minecraft Allianz"
//    Two lines, blocky Tektur font, purple gradient fill + white outline glow
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Position: center-right area (leave ~260px for character on left)
  const textCenterX = 310 + (W - 310) / 2; // ~755
  const line1Y = 162; // "Minecraft" baseline
  const line2Y = 272; // "Allianz" baseline

  // ── Helper: draw glowing outlined text ──────────────────────────────────────
  function drawGlowText(text, font, x, y, fillGrad, outlineColor, glowColor, glowBlur, align = 'center') {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';

    // 1. Far glow (wide, soft)
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = glowBlur * 2.2;
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.lineWidth   = 0;
    ctx.fillStyle   = glowColor.replace('1)', '0.15)').replace(/[\d.]+\)$/, '0.12)');
    ctx.fillText(text, x, y);

    // 2. Mid glow
    ctx.shadowBlur  = glowBlur * 1.2;
    ctx.fillStyle   = glowColor.replace(/[\d.]+\)$/, '0.2)');
    ctx.fillText(text, x, y);

    // 3. White outline — drawn as thick stroke first
    ctx.shadowColor = outlineColor;
    ctx.shadowBlur  = glowBlur * 0.7;
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth   = 5;
    ctx.lineJoin    = 'round';
    ctx.strokeText(text, x, y);

    // 4. Purple glow stroke
    ctx.strokeStyle = rgba('#9B30FF', 0.55);
    ctx.lineWidth   = 10;
    ctx.strokeText(text, x, y);

    // 5. Gradient fill
    ctx.shadowBlur  = glowBlur;
    ctx.shadowColor = glowColor;
    ctx.fillStyle   = fillGrad;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  // ── Gradient for title fill ──────────────────────────────────────────────────
  // "Minecraft" — vertical gradient
  const grad1 = ctx.createLinearGradient(0, line1Y - 90, 0, line1Y + 10);
  grad1.addColorStop(0.00, '#FFFFFF');
  grad1.addColorStop(0.25, '#E9D5FF');
  grad1.addColorStop(0.55, '#C084FC');
  grad1.addColorStop(0.85, '#9B30FF');
  grad1.addColorStop(1.00, '#6B0AC9');

  // "Allianz" — vertical gradient, slightly different hue range
  const grad2 = ctx.createLinearGradient(0, line2Y - 110, 0, line2Y + 10);
  grad2.addColorStop(0.00, '#F3E8FF');
  grad2.addColorStop(0.30, '#C084FC');
  grad2.addColorStop(0.65, '#9B30FF');
  grad2.addColorStop(1.00, '#4B0092');

  const titleFont1 = 'bold 108px Tektur';
  const titleFont2 = 'bold 122px Tektur';
  const glowClr    = 'rgba(155,48,255,1)';

  drawGlowText('Minecraft', titleFont1, textCenterX, line1Y, grad1, '#FFFFFF', glowClr, 28);
  drawGlowText('Allianz',   titleFont2, textCenterX, line2Y, grad2, '#FFFFFF', glowClr, 35);

  // ── Pixel-dot decoration rows (left/right of text block) ────────────────────
  // Small square pixels arranged like ore veins
  ctx.save();
  const rng7 = seededRandom(512);
  const textLeft  = textCenterX - 380;
  const textRight = textCenterX + 380;
  for (let i = 0; i < 14; i++) {
    const side = rng7() > 0.5 ? textLeft - 8 - rng7() * 30 : textRight + 8 + rng7() * 30;
    const dotY  = 100 + rng7() * 200;
    const dotS  = 3 + rng7() * 5;
    ctx.fillStyle = rgba('#9B30FF', 0.3 + rng7() * 0.45);
    ctx.fillRect(side, dotY, dotS, dotS);
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8b. TITLE→SUBTITLE SEPARATOR LINE
// ═══════════════════════════════════════════════════════════════════════════════
{
  const sepY = 299;
  const sepCX = 310 + (W - 310) / 2;
  const sepW  = 320;
  ctx.save();
  ctx.shadowColor = '#9B30FF';
  ctx.shadowBlur  = 8;
  const sepG = ctx.createLinearGradient(sepCX - sepW, 0, sepCX + sepW, 0);
  sepG.addColorStop(0, 'rgba(155,48,255,0)');
  sepG.addColorStop(0.2, 'rgba(155,48,255,0.55)');
  sepG.addColorStop(0.5, 'rgba(192,132,252,0.80)');
  sepG.addColorStop(0.8, 'rgba(155,48,255,0.55)');
  sepG.addColorStop(1, 'rgba(155,48,255,0)');
  ctx.strokeStyle = sepG;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(sepCX - sepW, sepY);
  ctx.lineTo(sepCX + sepW, sepY);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SUBTITLE — "Bot by Marius"
// ═══════════════════════════════════════════════════════════════════════════════
{
  const subX = 310 + (W - 310) / 2; // same center as title
  const subY = 358;

  ctx.save();
  ctx.font = '24px Pixelify';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Soft glow pass
  ctx.shadowColor = '#9B30FF';
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = rgba('#9B30FF', 0.35);
  ctx.fillText('Bot by Marius', subX, subY);

  // Clean fill pass
  ctx.shadowBlur  = 6;
  ctx.shadowColor = '#C084FC';
  const subGrad = ctx.createLinearGradient(subX - 140, subY - 20, subX + 140, subY);
  subGrad.addColorStop(0, 'rgba(224,210,255,0.70)');
  subGrad.addColorStop(0.5, 'rgba(255,255,255,0.92)');
  subGrad.addColorStop(1, 'rgba(192,132,252,0.70)');
  ctx.fillStyle = subGrad;
  ctx.fillText('Bot by Marius', subX, subY);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. SMALL CORNER LABEL — "minecraft allianz" monospace, top-right
// ═══════════════════════════════════════════════════════════════════════════════
{
  ctx.save();
  ctx.font = '11px GeistMono';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = rgba('#9B30FF', 0.35);
  ctx.fillText('MINECRAFT ALLIANZ BOT', W - 28, 20);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10b. SUBTLE HORIZONTAL SCAN-LINE TEXTURE — adds film/screen depth
// ═══════════════════════════════════════════════════════════════════════════════
{
  ctx.save();
  ctx.globalAlpha = 0.028;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10c. LEFT→RIGHT ATMOSPHERIC GRADIENT OVERLAY — left stays darker for char
// ═══════════════════════════════════════════════════════════════════════════════
{
  const atmo = ctx.createLinearGradient(0, 0, 340, 0);
  atmo.addColorStop(0, 'rgba(0,0,8,0.28)');
  atmo.addColorStop(0.6, 'rgba(0,0,0,0)');
  ctx.fillStyle = atmo;
  ctx.fillRect(0, 0, 340, H);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. FINAL VIGNETTE PASS — polish the edges
// ═══════════════════════════════════════════════════════════════════════════════
{
  const vg = ctx.createRadialGradient(W*0.5, H*0.5, H*0.18, W*0.5, H*0.5, H*0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.75, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,20,0.62)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════
const outPath = 'C:\\Users\\jploe\\Documents\\Webdesign\\claude Schwaben-Nannies\\discord-bot\\banner.png';
const buffer = canvas.toBuffer('image/png');
writeFileSync(outPath, buffer);
console.log(`Banner written → ${outPath}  (${W}×${H}px, ${(buffer.length/1024).toFixed(0)} KB)`);
