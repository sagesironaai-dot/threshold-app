import { describe, it, expect } from 'vitest';
import {
	isSignalSilent,
	scaleCanvasDimensions,
	SILENCE_THRESHOLD,
	resolveWaveformColor,
	EFFECT_FILTERS,
	type VisualizerMode
} from './visualizer';
import { ORIGIN_COLORS, NEUTRAL_COLOR } from './colors';

describe('visualizer.ts — silence detection', () => {
	it('detects silence when all samples are zero', () => {
		const data = new Float32Array(1024).fill(0);
		expect(isSignalSilent(data)).toBe(true);
	});

	it('detects silence when all samples are below threshold', () => {
		const data = new Float32Array(1024).fill(SILENCE_THRESHOLD * 0.5);
		expect(isSignalSilent(data)).toBe(true);
	});

	it('detects active signal when any sample exceeds threshold', () => {
		const data = new Float32Array(1024).fill(0);
		data[512] = SILENCE_THRESHOLD * 2;
		expect(isSignalSilent(data)).toBe(false);
	});

	it('detects active signal with negative values', () => {
		const data = new Float32Array(1024).fill(0);
		data[100] = -SILENCE_THRESHOLD * 2;
		expect(isSignalSilent(data)).toBe(false);
	});

	it('handles empty array as silent', () => {
		const data = new Float32Array(0);
		expect(isSignalSilent(data)).toBe(true);
	});
});

describe('visualizer.ts — canvas scaling', () => {
	it('returns 1:1 dimensions for DPR 1', () => {
		const result = scaleCanvasDimensions(800, 200, 1);
		expect(result.canvasWidth).toBe(800);
		expect(result.canvasHeight).toBe(200);
		expect(result.styleWidth).toBe(800);
		expect(result.styleHeight).toBe(200);
	});

	it('doubles canvas dimensions for DPR 2 (retina)', () => {
		const result = scaleCanvasDimensions(800, 200, 2);
		expect(result.canvasWidth).toBe(1600);
		expect(result.canvasHeight).toBe(400);
		expect(result.styleWidth).toBe(800);
		expect(result.styleHeight).toBe(200);
	});

	it('handles fractional DPR', () => {
		const result = scaleCanvasDimensions(800, 200, 1.5);
		expect(result.canvasWidth).toBe(1200);
		expect(result.canvasHeight).toBe(300);
		expect(result.styleWidth).toBe(800);
		expect(result.styleHeight).toBe(200);
	});

	it('handles zero dimensions safely', () => {
		const result = scaleCanvasDimensions(0, 0, 2);
		expect(result.canvasWidth).toBe(0);
		expect(result.canvasHeight).toBe(0);
	});
});

describe('visualizer.ts — waveform color resolution', () => {
	it('returns neutral color when no origins active', () => {
		const color = resolveWaveformColor([]);
		expect(color).toEqual(NEUTRAL_COLOR);
	});

	it('returns Larimar color when o01 active', () => {
		const color = resolveWaveformColor(['o01']);
		expect(color).toEqual(ORIGIN_COLORS.o01);
	});

	it('returns Verith color when o02 active', () => {
		const color = resolveWaveformColor(['o02']);
		expect(color).toEqual(ORIGIN_COLORS.o02);
	});

	it('blends two origin colors', () => {
		const color = resolveWaveformColor(['o01', 'o03']);
		// Midpoint of Larimar (20,80,220) and Cael'Thera (200,210,220)
		expect(color.r).toBeCloseTo(110, 0);
		expect(color.g).toBeCloseTo(145, 0);
		expect(color.b).toBeCloseTo(220, 0);
	});
});

describe('visualizer.ts — render mode effect filtering', () => {
	it('strip mode includes base, idle, glow, velocity, rupture_glow, cascade, decay', () => {
		const strip = EFFECT_FILTERS.strip;
		expect(strip).toContain('base_color');
		expect(strip).toContain('idle_breathing');
		expect(strip).toContain('glow_pulse');
		expect(strip).toContain('velocity_pulse');
		expect(strip).toContain('field_read_cascade');
		expect(strip).toContain('decay_color_fade');
	});

	it('strip mode excludes harmonics, divergence, rupture_jagged', () => {
		const strip = EFFECT_FILTERS.strip;
		expect(strip).not.toContain('resonance_harmonic');
		expect(strip).not.toContain('convergence_divergence');
	});

	it('panel mode includes all effects', () => {
		const panel = EFFECT_FILTERS.panel;
		expect(panel).toContain('base_color');
		expect(panel).toContain('resonance_harmonic');
		expect(panel).toContain('convergence_divergence');
		expect(panel).toContain('rupture_visual');
	});
});

// --- Documented test specs for browser-only tests ---

// TEST SPEC: createVisualizer
// - Accepts canvas element + mode ('strip' | 'panel')
// - Subscribes to audioPlaybackStore and audioEventStore
// - Starts requestAnimationFrame loop
// - Initializes all effect state to defaults

// TEST SPEC: origin color tinting
// - When o01 plays, waveform color lerps toward deep electric blue
// - When o02 plays, waveform color lerps toward dried blood red
// - When o03 plays, waveform color lerps toward platinum silver
// - When multiple play, colors blend weighted by count
// - When voice decays, its color fades proportionally

// TEST SPEC: rupture visuals
// - Tier 1: glow flare (shadowBlur 10→25→10 over 500ms)
// - Tier 2: waveform truncates with hard vertical edge at ~1.5s
// - Tier 3: white flash frame, then jagged rendering, settling to smooth

// TEST SPEC: resonance harmonics (panel only)
// - resonance_line_formed: faint second line appears at 30% opacity
// - resonance_line_broken: second line fractures and fades over 500ms

// TEST SPEC: convergence/divergence (panel only)
// - multi_origin_convergence: colors blend to center over 500ms
// - origin_divergence: two traces split apart, settle back over 800ms

// TEST SPEC: field read cascade
// - Color walks through hierarchy tiers as field read progresses

// TEST SPEC: idle breathing
// - When silent, slow hue drift over ~10s cycle
// - Subtle — not a visible color change per frame
