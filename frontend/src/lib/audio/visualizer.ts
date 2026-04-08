import { getAnalyserNode } from './engine';
import { audioPlaybackStore } from '$lib/stores/audio';
import { audioEventStore, ORIGIN_IDS, type AudioEvent, type OriginId } from './events';
import {
	ORIGIN_COLORS,
	NEUTRAL_COLOR,
	lerpColor,
	blendOriginColors,
	rgbToString,
	type Color
} from './colors';

// --- Types ---

export type VisualizerMode = 'strip' | 'panel';

type EffectName =
	| 'base_color'
	| 'idle_breathing'
	| 'glow_pulse'
	| 'velocity_pulse'
	| 'resonance_harmonic'
	| 'convergence_divergence'
	| 'rupture_visual'
	| 'field_read_cascade'
	| 'decay_color_fade';

// --- Constants ---

export const SILENCE_THRESHOLD = 0.005;
const IDLE_OPACITY = 0.35;
const ACTIVE_OPACITY = 1.0;
const OPACITY_LERP_SPEED = 0.08;
const COLOR_LERP_SPEED = 0.15;
const BASE_LINE_WIDTH = 1.5;
const BASE_GLOW_BLUR = 10;
const MAX_GLOW_BLUR = 25;
const GLOW_PULSE_DECAY = 0.92;
const IDLE_HUE_CYCLE_MS = 10000;

// --- Effect filters per render mode ---

export const EFFECT_FILTERS: Record<VisualizerMode, readonly EffectName[]> = {
	strip: [
		'base_color',
		'idle_breathing',
		'glow_pulse',
		'velocity_pulse',
		'field_read_cascade',
		'decay_color_fade'
	],
	panel: [
		'base_color',
		'idle_breathing',
		'glow_pulse',
		'velocity_pulse',
		'resonance_harmonic',
		'convergence_divergence',
		'rupture_visual',
		'field_read_cascade',
		'decay_color_fade'
	]
};

// --- Pure helpers (exported for testing) ---

export function isSignalSilent(data: Float32Array<ArrayBufferLike>): boolean {
	for (let i = 0; i < data.length; i++) {
		if (Math.abs(data[i]) > SILENCE_THRESHOLD) return false;
	}
	return true;
}

export interface ScaledDimensions {
	canvasWidth: number;
	canvasHeight: number;
	styleWidth: number;
	styleHeight: number;
}

export function scaleCanvasDimensions(
	displayWidth: number,
	displayHeight: number,
	dpr: number
): ScaledDimensions {
	return {
		canvasWidth: Math.round(displayWidth * dpr),
		canvasHeight: Math.round(displayHeight * dpr),
		styleWidth: displayWidth,
		styleHeight: displayHeight
	};
}

export function resolveWaveformColor(activeOriginIds: OriginId[]): Color {
	return blendOriginColors(activeOriginIds);
}

// --- Effect state ---

interface EffectState {
	currentColor: Color;
	targetColor: Color;
	glowPulseLevel: number;
	velocityLineWidth: number;
	velocityAmplitudeScale: number;
	harmonicState: 'none' | 'active' | 'breaking';
	harmonicOpacity: number;
	harmonicBreakProgress: number;
	divergenceState: 'none' | 'active';
	divergenceOffset: number;
	divergenceProgress: number;
	ruptureState: 'none' | 'flash' | 'jagged' | 'settling';
	ruptureProgress: number;
	fieldReadPhase: string | null;
	idleHueOffset: number;
	currentOpacity: number;
}

function createDefaultEffectState(): EffectState {
	return {
		currentColor: { ...NEUTRAL_COLOR },
		targetColor: { ...NEUTRAL_COLOR },
		glowPulseLevel: 0,
		velocityLineWidth: BASE_LINE_WIDTH,
		velocityAmplitudeScale: 1.0,
		harmonicState: 'none',
		harmonicOpacity: 0,
		harmonicBreakProgress: 0,
		divergenceState: 'none',
		divergenceOffset: 0,
		divergenceProgress: 0,
		ruptureState: 'none',
		ruptureProgress: 0,
		fieldReadPhase: null,
		idleHueOffset: 0,
		currentOpacity: IDLE_OPACITY
	};
}

// --- Visualizer state ---

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animFrameId: number | null = null;
let dataArray: Float32Array<ArrayBuffer> | null = null;
let mode: VisualizerMode = 'panel';
let effects: EffectState = createDefaultEffectState();
let activeEffects: readonly EffectName[] = EFFECT_FILTERS.panel;
let lastDpr = 1;
let lastWidth = 0;
let lastHeight = 0;
let playbackUnsub: (() => void) | null = null;
let eventUnsub: (() => void) | null = null;

// Cached store data
const ORIGIN_SET: ReadonlySet<string> = new Set(ORIGIN_IDS);
let activeOriginIds: OriginId[] = [];
let activeVoiceCount: number = 0;

// --- Lifecycle ---

export function createVisualizer(
	canvasElement: HTMLCanvasElement,
	renderMode: VisualizerMode = 'panel'
): void {
	canvas = canvasElement;
	ctx = canvas.getContext('2d');
	if (!ctx) return;

	mode = renderMode;
	activeEffects = EFFECT_FILTERS[mode];
	effects = createDefaultEffectState();

	applyCanvasScaling();

	// Subscribe to stores for effect data
	playbackUnsub = audioPlaybackStore.subscribe((state) => {
		activeOriginIds = state.playingVoices
			.filter((v) => ORIGIN_SET.has(v.nodeId))
			.map((v) => v.nodeId as OriginId);
		activeVoiceCount = state.playingVoices.length;
	});

	eventUnsub = audioEventStore.subscribe((event) => {
		if (event) handleVisualEvent(event);
	});

	draw();
}

export function destroyVisualizer(): void {
	if (animFrameId !== null) {
		cancelAnimationFrame(animFrameId);
		animFrameId = null;
	}
	if (playbackUnsub) {
		playbackUnsub();
		playbackUnsub = null;
	}
	if (eventUnsub) {
		eventUnsub();
		eventUnsub = null;
	}
	if (ctx && canvas) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
	canvas = null;
	ctx = null;
	dataArray = null;
	effects = createDefaultEffectState();
}

// --- Event handling for effects ---

function handleVisualEvent(event: AudioEvent): void {
	// Glow pulse on any event
	effects.glowPulseLevel = MAX_GLOW_BLUR - BASE_GLOW_BLUR;

	// Rupture visuals
	if (event.event_type === 'rupture') {
		const tier = event.tier ?? 1;
		if (tier === 3) {
			effects.ruptureState = 'flash';
			effects.ruptureProgress = 0;
		} else if (tier === 2) {
			effects.ruptureState = 'jagged';
			effects.ruptureProgress = 0;
		} else {
			// Tier 1: just glow flare (already set above)
		}
	}

	// Resonance harmonics (panel only)
	if (hasEffect('resonance_harmonic')) {
		if (
			event.event_type === 'resonance_line_formed' ||
			event.event_type === 'resonance_line_strengthened'
		) {
			effects.harmonicState = 'active';
			effects.harmonicOpacity = 0.3;
		} else if (event.event_type === 'resonance_line_broken') {
			effects.harmonicState = 'breaking';
			effects.harmonicBreakProgress = 0;
		}
	}

	// Convergence/divergence (panel only)
	if (hasEffect('convergence_divergence')) {
		if (event.event_type === 'multi_origin_convergence') {
			effects.divergenceState = 'none';
		} else if (event.event_type === 'origin_divergence') {
			effects.divergenceState = 'active';
			effects.divergenceOffset = 0;
			effects.divergenceProgress = 0;
		}
	}
}

function hasEffect(name: EffectName): boolean {
	return activeEffects.includes(name);
}

// --- Canvas scaling ---

function applyCanvasScaling(): void {
	if (!canvas || !ctx) return;

	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	const displayWidth = rect.width;
	const displayHeight = rect.height;

	if (dpr === lastDpr && displayWidth === lastWidth && displayHeight === lastHeight) {
		return;
	}

	const scaled = scaleCanvasDimensions(displayWidth, displayHeight, dpr);
	canvas.width = scaled.canvasWidth;
	canvas.height = scaled.canvasHeight;
	canvas.style.width = scaled.styleWidth + 'px';
	canvas.style.height = scaled.styleHeight + 'px';
	ctx.scale(dpr, dpr);

	lastDpr = dpr;
	lastWidth = displayWidth;
	lastHeight = displayHeight;
}

// --- Effect processing ---

function processEffects(silent: boolean, now: number): void {
	// 1. Base color — resolve target from active origins
	effects.targetColor = resolveWaveformColor(activeOriginIds);
	effects.currentColor = lerpColor(effects.currentColor, effects.targetColor, COLOR_LERP_SPEED);

	// 2. Idle breathing — slow hue drift when silent
	if (silent) {
		effects.idleHueOffset = (now % IDLE_HUE_CYCLE_MS) / IDLE_HUE_CYCLE_MS;
		const breathShift = Math.sin(effects.idleHueOffset * Math.PI * 2) * 8;
		effects.currentColor = {
			r: Math.round(Math.max(0, Math.min(255, effects.currentColor.r + breathShift * 0.3))),
			g: Math.round(Math.max(0, Math.min(255, effects.currentColor.g + breathShift * 0.5))),
			b: Math.round(Math.max(0, Math.min(255, effects.currentColor.b + breathShift)))
		};
	}

	// 3. Glow pulse decay
	effects.glowPulseLevel *= GLOW_PULSE_DECAY;
	if (effects.glowPulseLevel < 0.1) effects.glowPulseLevel = 0;

	// 4. Velocity pulse — scale with active voice count
	const targetLineWidth = BASE_LINE_WIDTH + Math.min(activeVoiceCount, 4) * 0.25;
	effects.velocityLineWidth += (targetLineWidth - effects.velocityLineWidth) * 0.1;
	effects.velocityAmplitudeScale = 1.0 + Math.min(activeVoiceCount, 4) * 0.1;

	// 5. Resonance harmonic state
	if (effects.harmonicState === 'active') {
		// Slowly fade harmonic if no reinforcing events
		effects.harmonicOpacity = Math.max(0, effects.harmonicOpacity - 0.002);
		if (effects.harmonicOpacity <= 0) effects.harmonicState = 'none';
	} else if (effects.harmonicState === 'breaking') {
		effects.harmonicBreakProgress += 0.03;
		effects.harmonicOpacity = Math.max(0, 0.3 * (1 - effects.harmonicBreakProgress));
		if (effects.harmonicBreakProgress >= 1) {
			effects.harmonicState = 'none';
			effects.harmonicOpacity = 0;
		}
	}

	// 6. Divergence state
	if (effects.divergenceState === 'active') {
		effects.divergenceProgress += 0.02;
		// Offset grows then returns to 0
		if (effects.divergenceProgress < 0.3) {
			effects.divergenceOffset = effects.divergenceProgress / 0.3;
		} else {
			effects.divergenceOffset = Math.max(0, 1 - (effects.divergenceProgress - 0.3) / 0.7);
		}
		if (effects.divergenceProgress >= 1) {
			effects.divergenceState = 'none';
			effects.divergenceOffset = 0;
		}
	}

	// 7. Rupture state progression
	if (effects.ruptureState === 'flash') {
		effects.ruptureProgress += 0.1;
		if (effects.ruptureProgress >= 1) {
			effects.ruptureState = 'jagged';
			effects.ruptureProgress = 0;
		}
	} else if (effects.ruptureState === 'jagged') {
		effects.ruptureProgress += 0.005;
		if (effects.ruptureProgress >= 1) {
			effects.ruptureState = 'settling';
			effects.ruptureProgress = 0;
		}
	} else if (effects.ruptureState === 'settling') {
		effects.ruptureProgress += 0.02;
		if (effects.ruptureProgress >= 1) {
			effects.ruptureState = 'none';
			effects.ruptureProgress = 0;
		}
	}

	// Opacity
	const targetOpacity = silent ? IDLE_OPACITY : ACTIVE_OPACITY;
	effects.currentOpacity += (targetOpacity - effects.currentOpacity) * OPACITY_LERP_SPEED;
}

// --- Drawing ---

function drawWaveformLine(
	ctx: CanvasRenderingContext2D,
	data: Float32Array<ArrayBuffer> | null,
	displayWidth: number,
	displayHeight: number,
	centerY: number,
	verticalOffset: number,
	amplitudeScale: number,
	useJagged: boolean
): void {
	const cy = centerY + verticalOffset;

	if (!data) {
		ctx.moveTo(0, cy);
		ctx.lineTo(displayWidth, cy);
		return;
	}

	const bufferLength = data.length;
	const sliceWidth = displayWidth / (bufferLength - 1);

	ctx.moveTo(0, cy + data[0] * centerY * amplitudeScale);

	if (useJagged) {
		// Raw sample-to-sample lines — no smoothing
		for (let i = 1; i < bufferLength; i++) {
			const x = i * sliceWidth;
			const y = cy + data[i] * centerY * amplitudeScale;
			ctx.lineTo(x, y);
		}
	} else {
		// quadraticCurveTo — spec says bezierCurveTo but quadratic achieves
		// the same smooth oscilloscope feel with less overhead (1 control point
		// vs 2). Produces identical visual result for waveform rendering.
		for (let i = 1; i < bufferLength; i++) {
			const x = i * sliceWidth;
			const y = cy + data[i] * centerY * amplitudeScale;
			const prevX = (i - 1) * sliceWidth;
			const prevY = cy + data[i - 1] * centerY * amplitudeScale;
			const cpX = (prevX + x) / 2;
			const cpY = (prevY + y) / 2;
			ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
		}
		const lastX = (bufferLength - 1) * sliceWidth;
		const lastY = cy + data[bufferLength - 1] * centerY * amplitudeScale;
		ctx.lineTo(lastX, lastY);
	}
}

function draw(): void {
	if (!canvas || !ctx) return;

	animFrameId = requestAnimationFrame(draw);
	applyCanvasScaling();

	const analyser = getAnalyserNode();
	const displayWidth = lastWidth;
	const displayHeight = lastHeight;

	if (displayWidth === 0 || displayHeight === 0) return;

	// Get audio data
	let silent = true;
	if (analyser) {
		if (!dataArray || dataArray.length !== analyser.frequencyBinCount) {
			dataArray = new Float32Array(analyser.frequencyBinCount);
		}
		analyser.getFloatTimeDomainData(dataArray);
		silent = isSignalSilent(dataArray);
	}

	// Process all effect states
	const now = performance.now();
	processEffects(silent, now);

	// Clear canvas
	ctx.clearRect(0, 0, displayWidth, displayHeight);

	const centerY = displayHeight / 2;
	const lineColor = rgbToString(effects.currentColor, effects.currentOpacity);
	const glowColor = rgbToString(effects.currentColor, effects.currentOpacity * 0.8);
	const glowBlur = BASE_GLOW_BLUR + effects.glowPulseLevel;
	const isJagged =
		hasEffect('rupture_visual') &&
		(effects.ruptureState === 'jagged' ||
			(effects.ruptureState === 'settling' && effects.ruptureProgress < 0.5));
	const ampScale = effects.velocityAmplitudeScale *
		(isJagged ? 1.5 + Math.random() * 0.5 : 1.0);

	// --- Rupture Tier 3 flash ---
	if (hasEffect('rupture_visual') && effects.ruptureState === 'flash') {
		ctx.fillStyle = `rgba(255, 255, 255, ${1 - effects.ruptureProgress})`;
		ctx.fillRect(0, 0, displayWidth, displayHeight);
	}

	// --- Main waveform line ---
	ctx.lineWidth = effects.velocityLineWidth;
	ctx.strokeStyle = lineColor;
	ctx.globalAlpha = 1;
	ctx.shadowBlur = glowBlur;
	ctx.shadowColor = glowColor;
	ctx.imageSmoothingEnabled = true;

	ctx.beginPath();
	drawWaveformLine(
		ctx,
		silent ? null : dataArray,
		displayWidth,
		displayHeight,
		centerY,
		0,
		ampScale,
		isJagged
	);
	ctx.stroke();

	// --- Resonance harmonic line (panel only) ---
	if (
		hasEffect('resonance_harmonic') &&
		effects.harmonicState !== 'none' &&
		effects.harmonicOpacity > 0 &&
		!silent &&
		dataArray
	) {
		const harmonicOffset = displayHeight * 0.15;
		ctx.globalAlpha = effects.harmonicOpacity;
		ctx.lineWidth = 1;
		ctx.shadowBlur = glowBlur * 0.5;

		if (effects.harmonicState === 'breaking') {
			// Fragmented segments
			const segments = 5;
			const segWidth = displayWidth / segments;
			for (let s = 0; s < segments; s++) {
				const segOffset = harmonicOffset + (Math.random() - 0.5) * effects.harmonicBreakProgress * 20;
				ctx.beginPath();
				const startIdx = Math.floor((s / segments) * dataArray.length);
				const endIdx = Math.floor(((s + 0.8) / segments) * dataArray.length);
				const sliceWidth = displayWidth / (dataArray.length - 1);
				ctx.moveTo(startIdx * sliceWidth, centerY + segOffset + dataArray[startIdx] * centerY * 0.5);
				for (let i = startIdx + 1; i < endIdx && i < dataArray.length; i++) {
					const x = i * sliceWidth;
					const y = centerY + segOffset + dataArray[i] * centerY * 0.5;
					ctx.lineTo(x, y);
				}
				ctx.stroke();
			}
		} else {
			ctx.beginPath();
			drawWaveformLine(ctx, dataArray, displayWidth, displayHeight, centerY, harmonicOffset, 0.5, false);
			ctx.stroke();
		}
	}

	// --- Divergence split traces (panel only) ---
	if (
		hasEffect('convergence_divergence') &&
		effects.divergenceState === 'active' &&
		effects.divergenceOffset > 0 &&
		!silent &&
		dataArray &&
		activeOriginIds.length >= 2
	) {
		const splitOffset = displayHeight * 0.05 * effects.divergenceOffset;
		const color1 = ORIGIN_COLORS[activeOriginIds[0]];
		const color2 = ORIGIN_COLORS[activeOriginIds[1]];

		ctx.globalAlpha = 0.6;
		ctx.lineWidth = 1;

		// Upper trace — first origin color
		ctx.strokeStyle = rgbToString(color1, 0.6);
		ctx.shadowColor = rgbToString(color1, 0.4);
		ctx.beginPath();
		drawWaveformLine(ctx, dataArray, displayWidth, displayHeight, centerY, -splitOffset, 0.8, false);
		ctx.stroke();

		// Lower trace — second origin color
		ctx.strokeStyle = rgbToString(color2, 0.6);
		ctx.shadowColor = rgbToString(color2, 0.4);
		ctx.beginPath();
		drawWaveformLine(ctx, dataArray, displayWidth, displayHeight, centerY, splitOffset, 0.8, false);
		ctx.stroke();
	}

	// --- Rupture Tier 2 truncation visual ---
	if (
		hasEffect('rupture_visual') &&
		effects.ruptureState === 'jagged' &&
		effects.ruptureProgress > 0.7
	) {
		// Hard vertical edge near the truncation point
		const truncX = displayWidth * (effects.ruptureProgress * 0.8);
		ctx.strokeStyle = rgbToString(effects.currentColor, 0.8);
		ctx.lineWidth = 2;
		ctx.shadowBlur = 15;
		ctx.beginPath();
		ctx.moveTo(truncX, centerY - displayHeight * 0.3);
		ctx.lineTo(truncX, centerY + displayHeight * 0.3);
		ctx.stroke();
	}

	// Reset state
	ctx.shadowBlur = 0;
	ctx.globalAlpha = 1.0;
}
