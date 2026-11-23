export interface Isobath {
  d: string;
  /** Curva índice (cada quinta) se dibuja un poco más visible, como en las cartas náuticas. */
  major: boolean;
  label?: { x: number; y: number; text: string };
}

const WIDTH = 900;
const STEP = 18;

function depthAt(x: number, i: number): number {
  const base = 64 + i * 50;
  return (
    base +
    Math.sin(x / 150 + i * 0.55) * (16 + i * 1.5) +
    Math.sin(x / 63 + i * 1.3) * 6 +
    Math.cos(x / 320 - i * 0.4) * 24
  );
}

/**
 * Curvas de profundidad (isóbatas) deterministas para el fondo del login.
 * Determinista = misma imagen en cada arranque, sin aleatoriedad.
 */
export function buildIsobaths(count = 17): Isobath[] {
  const lines: Isobath[] = [];
  for (let i = 0; i < count; i++) {
    const points: string[] = [];
    for (let x = -STEP; x <= WIDTH + STEP; x += STEP) {
      points.push(`${x} ${depthAt(x, i).toFixed(1)}`);
    }
    const line: Isobath = { d: `M${points.join(' L')}`, major: i % 5 === 4 };
    if (i % 3 === 1) {
      const x = 120 + ((i * 137) % 600);
      line.label = { x, y: depthAt(x, i) + 4, text: `${(i + 1) * 5} m` };
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Ruta de acento (la única marca de color aqua): entra por la esquina inferior derecha
 * y termina en "tu negocio", lejos del logotipo (abajo a la izquierda).
 */
export function buildRoute(): { d: string; end: { x: number; y: number } } {
  const points: string[] = [];
  let end = { x: 0, y: 0 };
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const x = 930 - t * 420;
    const y = 880 - t * 600 + Math.sin(t * Math.PI * 2.2) * 34;
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    end = { x, y };
  }
  return { d: `M${points.join(' L')}`, end };
}
