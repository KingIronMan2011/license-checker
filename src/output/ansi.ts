type ColorStream = NodeJS.WriteStream & { isTTY?: boolean };

const ESC = "\u001b[";
const ansi256Component = (value: number): number =>
  Math.min(5, value < 48 ? 0 : value < 115 ? 1 : Math.round((value - 35) / 40));

function getColorLevel(): number {
  const forced = process.env.FORCE_COLOR;
  if (forced !== undefined) {
    if (forced === "0") return 0;
    const parsed = Number.parseInt(forced, 10);
    return Number.isNaN(parsed) ? 1 : Math.max(0, Math.min(3, parsed));
  }

  if (process.env.NO_COLOR !== undefined || process.env.NODE_DISABLE_COLORS) {
    return 0;
  }

  const stream = process.stdout as ColorStream;
  if (!stream.isTTY || process.env.TERM === "dumb") return 0;

  if (/^(truecolor|24bit)$/i.test(process.env.COLORTERM ?? "")) return 3;
  if (/-256(color)?$/i.test(process.env.TERM ?? "")) return 2;
  if (process.platform === "win32" || process.env.TERM) return 1;
  return 0;
}

export function supportsBasicColor(): boolean {
  return getColorLevel() >= 1;
}

export function boldRed(value: string, enabled = supportsBasicColor()): string {
  if (!enabled) return value;
  return `${ESC}1m${ESC}31m${value}${ESC}39m${ESC}22m`;
}

function rgbToAnsi256(red: number, green: number, blue: number): number {
  if (red === green && green === blue) {
    if (red < 8) return 16;
    if (red > 248) return 231;
    return Math.round((red - 8) / 10) + 232;
  }
  return (
    16 +
    36 * ansi256Component(red) +
    6 * ansi256Component(green) +
    ansi256Component(blue)
  );
}

function rgbToAnsi16(red: number, green: number, blue: number): number {
  const palette = [
    [0, 0, 0],
    [128, 0, 0],
    [0, 128, 0],
    [128, 128, 0],
    [0, 0, 128],
    [128, 0, 128],
    [0, 128, 128],
    [192, 192, 192],
    [128, 128, 128],
    [255, 0, 0],
    [0, 255, 0],
    [255, 255, 0],
    [0, 0, 255],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 255],
  ] as const;

  let closest = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;
  palette.forEach(([paletteRed, paletteGreen, paletteBlue], index) => {
    const distance =
      (red - paletteRed) ** 2 +
      (green - paletteGreen) ** 2 +
      (blue - paletteBlue) ** 2;
    if (distance < smallestDistance) {
      closest = index;
      smallestDistance = distance;
    }
  });
  return closest < 8 ? 40 + closest : 100 + closest - 8;
}

function rgbBackground(red: number, green: number, blue: number): string {
  const level = getColorLevel();
  if (level >= 3) return `${ESC}48;2;${red};${green};${blue}m`;
  if (level >= 2) return `${ESC}48;5;${rgbToAnsi256(red, green, blue)}m`;
  return `${ESC}${rgbToAnsi16(red, green, blue)}m`;
}

export function whiteOnRgb(
  value: string,
  rgb: readonly [number, number, number],
  enabled = supportsBasicColor(),
): string {
  if (!enabled) return value;
  const [red, green, blue] = rgb;
  return `${ESC}37m${rgbBackground(red, green, blue)}${value}${ESC}49m${ESC}39m`;
}

export function dim(value: string, enabled = supportsBasicColor()): string {
  return enabled ? `${ESC}2m${value}${ESC}22m` : value;
}
