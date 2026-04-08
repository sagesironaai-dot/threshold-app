import type { OriginId } from './events';

// --- Color type ---

export interface Color {
	r: number;
	g: number;
	b: number;
}

// --- Origin colors ---
// Larimar: deep electric blue. Verith: dried blood red. Cael'Thera: platinum silver.

export const ORIGIN_COLORS: Record<OriginId, Color> = {
	o01: { r: 20, g: 80, b: 220 },
	o02: { r: 140, g: 30, b: 30 },
	o03: { r: 200, g: 210, b: 220 }
};

export const NEUTRAL_COLOR: Color = { r: 160, g: 210, b: 220 };

// --- Color utilities ---

function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}

export function lerpColor(a: Color, b: Color, t: number): Color {
	const ct = clamp(t, 0, 1);
	return {
		r: Math.round(a.r + (b.r - a.r) * ct),
		g: Math.round(a.g + (b.g - a.g) * ct),
		b: Math.round(a.b + (b.b - a.b) * ct)
	};
}

export function blendOriginColors(activeOriginIds: OriginId[]): Color {
	if (activeOriginIds.length === 0) return { ...NEUTRAL_COLOR };
	if (activeOriginIds.length === 1) return { ...ORIGIN_COLORS[activeOriginIds[0]] };

	let r = 0, g = 0, b = 0;
	for (const id of activeOriginIds) {
		const c = ORIGIN_COLORS[id];
		r += c.r;
		g += c.g;
		b += c.b;
	}
	const n = activeOriginIds.length;
	return {
		r: Math.round(r / n),
		g: Math.round(g / n),
		b: Math.round(b / n)
	};
}

export function rgbToString(color: Color, alpha: number = 1): string {
	return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}
