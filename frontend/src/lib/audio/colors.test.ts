import { describe, it, expect } from 'vitest';
import {
	ORIGIN_COLORS,
	NEUTRAL_COLOR,
	lerpColor,
	blendOriginColors,
	rgbToString,
	type Color
} from './colors';

describe('colors.ts — origin color constants', () => {
	it('defines Larimar as deep electric blue', () => {
		expect(ORIGIN_COLORS.o01).toEqual({ r: 20, g: 80, b: 220 });
	});

	it('defines Verith as dried blood red', () => {
		expect(ORIGIN_COLORS.o02).toEqual({ r: 140, g: 30, b: 30 });
	});

	it('defines Cael\'Thera as platinum silver', () => {
		expect(ORIGIN_COLORS.o03).toEqual({ r: 200, g: 210, b: 220 });
	});

	it('defines neutral as cool aqua', () => {
		expect(NEUTRAL_COLOR).toEqual({ r: 160, g: 210, b: 220 });
	});
});

describe('colors.ts — lerpColor', () => {
	const blue: Color = { r: 0, g: 0, b: 255 };
	const red: Color = { r: 255, g: 0, b: 0 };

	it('returns first color at t=0', () => {
		expect(lerpColor(blue, red, 0)).toEqual({ r: 0, g: 0, b: 255 });
	});

	it('returns second color at t=1', () => {
		expect(lerpColor(blue, red, 1)).toEqual({ r: 255, g: 0, b: 0 });
	});

	it('returns midpoint at t=0.5', () => {
		const mid = lerpColor(blue, red, 0.5);
		expect(mid.r).toBeCloseTo(128, 0);
		expect(mid.g).toBe(0);
		expect(mid.b).toBeCloseTo(128, 0);
	});

	it('clamps t below 0', () => {
		expect(lerpColor(blue, red, -0.5)).toEqual({ r: 0, g: 0, b: 255 });
	});

	it('clamps t above 1', () => {
		expect(lerpColor(blue, red, 1.5)).toEqual({ r: 255, g: 0, b: 0 });
	});
});

describe('colors.ts — blendOriginColors', () => {
	it('returns neutral when no origins active', () => {
		expect(blendOriginColors([])).toEqual(NEUTRAL_COLOR);
	});

	it('returns single origin color when one active', () => {
		expect(blendOriginColors(['o01'])).toEqual(ORIGIN_COLORS.o01);
	});

	it('blends two origins equally', () => {
		const blended = blendOriginColors(['o01', 'o02']);
		// Midpoint of Larimar (20,80,220) and Verith (140,30,30)
		expect(blended.r).toBeCloseTo(80, 0);
		expect(blended.g).toBeCloseTo(55, 0);
		expect(blended.b).toBeCloseTo(125, 0);
	});

	it('blends all three origins', () => {
		const blended = blendOriginColors(['o01', 'o02', 'o03']);
		// Average of all three
		expect(blended.r).toBeCloseTo(120, 0);
		expect(blended.g).toBeCloseTo(107, 0);
		expect(blended.b).toBeCloseTo(157, 0);
	});
});

describe('colors.ts — rgbToString', () => {
	it('converts to rgba string with default alpha 1', () => {
		expect(rgbToString({ r: 160, g: 210, b: 220 })).toBe('rgba(160, 210, 220, 1)');
	});

	it('converts with custom alpha', () => {
		expect(rgbToString({ r: 20, g: 80, b: 220 }, 0.5)).toBe('rgba(20, 80, 220, 0.5)');
	});
});
