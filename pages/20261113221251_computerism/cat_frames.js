const cycle = (frames, seconds, rate) => frames[Math.floor(Math.max(0, seconds) * rate) % frames.length];
const sequence = (frames, seconds, rate) => frames[Math.min(frames.length - 1, Math.floor(Math.max(0, seconds) * rate))];

export function spriteFrame(cat, seconds) {
  switch (cat.mode) {
    case 'walk': return Math.floor(cat.phase / (Math.PI * 2) * 6) % 6;
    case 'crawl': return [24, 25, 26, 25][Math.floor(cat.phase / (Math.PI * 2) * 4) % 4];
    case 'sit': return sequence([6, 7, 8, 9, 10, 11], seconds, 4);
    case 'look': return cycle([9, 10, 11, 10], seconds, 2);
    case 'groom': return cycle([12, 13, 14, 15, 14, 13, 16, 17], seconds, 5);
    case 'crouch':
    case 'prepare': return sequence([18, 19], seconds, 4);
    case 'jump': return cat.verticalSpeed > 220 ? 20 : cat.verticalSpeed > -180 ? 21 : 22;
    case 'land': return sequence([22, 23], seconds, 6);
    case 'play':
    case 'scratch': return cycle([25, 26, 25, 27], seconds, 5);
    case 'roll': return cycle([28, 29, 29, 28], seconds, 3);
    case 'sleep': return cycle([30, 31, 32, 31], seconds, 1);
    case 'wake': return sequence([33, 34, 34, 35], seconds, 3);
    default: return 6;
  }
}
