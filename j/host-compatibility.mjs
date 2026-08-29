import MACPROVIDER_AUTOTUNE_CANDIDATES from './macprovider/autotune-candidates.published-2026-07-29.json' with { type: 'json' };

const SAFETY_MARGIN_GB = 4;

const TIER_ORDER = { C: 1, B: 2, A: 3, S: 4 };

const DISPLAY_NAMES = Object.freeze({
  'google-gemma-4-26b-a4b-it': 'Gemma 4 26B-A4B',
  'meta-llama/llama-3.1-8b-instruct': 'Llama 3.1 8B Instruct',
  'meta-llama/llama-3.2-3b-instruct': 'Llama 3.2 3B Instruct',
  'nvidia/nemotron-3-nano-30b-a3b': 'Nemotron 3 Nano 30B-A3B',
  'openai/gpt-oss-20b': 'GPT-OSS 20B',
  'qwen2.5-coder-32b-instruct': 'Qwen2.5 Coder 32B',
  'qwen3-32b': 'Qwen3 32B',
  'qwen3-8b': 'Qwen3 8B',
  'qwen3-coder-30b-a3b-instruct': 'Qwen3 Coder 30B-A3B',
});

const CANIRUN_ADVISORY_MAP = Object.freeze({
  'google-gemma-4-26b-a4b-it': { modelId: 'gemma4-26b-a4b-it', quantization: 'Q4_K_M' },
  'meta-llama/llama-3.1-8b-instruct': { modelId: 'llama3.1-8b', quantization: 'Q4_K_M' },
  'meta-llama/llama-3.2-3b-instruct': { modelId: 'llama3.2-3b', quantization: 'Q4_K_M' },
  'nvidia/nemotron-3-nano-30b-a3b': { modelId: 'nemotron-nano-30b', quantization: 'Q4_K_M' },
  'openai/gpt-oss-20b': { modelId: 'gpt-oss-20b', quantization: 'Q4_K_M' },
  'qwen2.5-coder-32b-instruct': { modelId: 'qwen2.5-coder-32b', quantization: 'Q4_K_M' },
  'qwen3-32b': { modelId: 'qwen3-32b', quantization: 'Q4_K_M' },
  'qwen3-8b': { modelId: 'qwen3-8b', quantization: 'Q4_K_M' },
  'qwen3-coder-30b-a3b-instruct': { modelId: 'qwen3-coder-30b', quantization: 'Q4_K_M' },
});

const OMLX_SPEED_HINTS = Object.freeze([
  {
    rowKey: 'openai/gpt-oss-20b',
    chip: 'Apple M4',
    ramGb: 24,
    contextTokens: 4096,
    ppTps: 384,
    tgTps: 32.7,
    modelName: 'gpt-oss-20b-MXFP4-Q8',
    observedAt: '2026-08-20',
    sourceUrl: 'https://omlx.ai/benchmarks/performance?model=gpt-oss-20b-MXFP4-Q8',
  },
  {
    rowKey: 'openai/gpt-oss-20b',
    chip: 'Apple M4 Max',
    ramGb: 64,
    contextTokens: 4096,
    ppTps: 1511,
    tgTps: 110.5,
    modelName: 'gpt-oss-20b-MXFP4-Q8',
    observedAt: '2026-08-21',
    sourceUrl: 'https://omlx.ai/benchmarks/performance?model=gpt-oss-20b-MXFP4-Q8',
  },
  {
    rowKey: 'google-gemma-4-26b-a4b-it',
    chip: 'Apple M1 Pro',
    ramGb: 32,
    contextTokens: 4096,
    ppTps: 247.3,
    tgTps: 29.6,
    modelName: 'gemma-4-26B-A4B-it-qat-4bit',
    observedAt: '2026-08-21',
    sourceUrl: 'https://omlx.ai/benchmarks/performance?model=gemma-4-26B-A4B-it-qat-4bit',
  },
  {
    rowKey: 'google-gemma-4-26b-a4b-it',
    chip: 'Apple M5 Pro',
    ramGb: 48,
    contextTokens: 32768,
    ppTps: 1467,
    tgTps: 51.9,
    modelName: 'gemma-4-26B-A4B-it-qat-4bit',
    observedAt: '2026-08-19',
    sourceUrl: 'https://omlx.ai/benchmarks/performance?model=gemma-4-26B-A4B-it-qat-4bit',
  },
]);

const CANIRUN_SPEED_HINTS = Object.freeze([
  { rowKey: 'qwen3-8b', chip: 'Apple M4', ramGb: 32, tgTps: 17, observedAt: '2026-08-21' },
  { rowKey: 'meta-llama/llama-3.1-8b-instruct', chip: 'Apple M4', ramGb: 32, tgTps: 17, observedAt: '2026-08-21' },
  { rowKey: 'meta-llama/llama-3.2-3b-instruct', chip: 'Apple M4', ramGb: 32, tgTps: 39, observedAt: '2026-08-21' },
  { rowKey: 'qwen3-coder-30b-a3b-instruct', chip: 'Apple M4', ramGb: 32, tgTps: 49, observedAt: '2026-08-21' },
  { rowKey: 'google-gemma-4-26b-a4b-it', chip: 'Apple M4', ramGb: 32, tgTps: 37, observedAt: '2026-08-21' },
  { rowKey: 'qwen3-8b', chip: 'Apple M5', ramGb: 32, tgTps: 22, observedAt: '2026-08-21' },
  { rowKey: 'meta-llama/llama-3.1-8b-instruct', chip: 'Apple M5', ramGb: 32, tgTps: 22, observedAt: '2026-08-21' },
  { rowKey: 'meta-llama/llama-3.2-3b-instruct', chip: 'Apple M5', ramGb: 32, tgTps: 50, observedAt: '2026-08-21' },
  { rowKey: 'qwen3-coder-30b-a3b-instruct', chip: 'Apple M4 Max', ramGb: 128, tgTps: 223, observedAt: '2026-08-21' },
]);

export const HOST_CATALOG = Object.freeze({
  releaseId: MACPROVIDER_AUTOTUNE_CANDIDATES.version,
  generatedAt: MACPROVIDER_AUTOTUNE_CANDIDATES.generated_at,
  policyVersion: MACPROVIDER_AUTOTUNE_CANDIDATES.policy_version,
  candidateCatalogSha256: '56c4c20a8d0b3a1944ff0539829d0f517097c5189f22d7f1453c8e491dff1720',
  candidateCatalogPath: 'j/macprovider/autotune-candidates.published-2026-07-29.json',
  signaturePath: 'j/macprovider/autotune-candidates.published-2026-07-29.json.sig',
  signerKeyId: 'streamvc-autotune-static-v4',
  source: MACPROVIDER_AUTOTUNE_CANDIDATES.source,
  rows: Object.freeze(Object.entries(MACPROVIDER_AUTOTUNE_CANDIDATES.rows).map(([key, row]) => Object.freeze({
    key,
    name: DISPLAY_NAMES[key] || key,
    modelId: row.model_id,
    modelRevision: row.model_revision,
    modelSha256: row.model_sha256,
    minRamGb: row.min_ram_gb,
    minBandwidthTier: row.min_bandwidth_tier,
    minSustainedTps: row.bench_gate?.min_sustained_tps,
    max4kTtftMs: row.bench_gate?.max_4k_ttft_ms,
    provenance: row.bench_gate?.provenance?.source || 'catalog',
    runtimeStatus: row.runtime_status,
  }))),
});

function normalizeChip(chip) {
  if (typeof chip !== 'string') return 'Apple Silicon';
  const compact = chip.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Apple Silicon';
  const match = compact.match(/^apple\s+m([1-5])(?:\s+(pro|max|ultra))?$/i);
  if (!match) return 'Apple Silicon';
  const suffix = match[2] ? ` ${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()}` : '';
  return `Apple M${match[1]}${suffix}`;
}

export function deriveBandwidthTier(chip) {
  const value = normalizeChip(chip).toLowerCase();
  const match = value.match(/^apple\s+m[1-5](?:\s+(pro|max|ultra))?$/);
  if (!match) return 'C';
  if (match[1] === 'ultra') return 'S';
  if (match[1] === 'max') return 'A';
  if (match[1] === 'pro') return 'B';
  return 'C';
}

function chipGeneration(chip) {
  const match = normalizeChip(chip).match(/\bM([1-5])\b/i);
  return match ? Number(match[1]) : 0;
}

function speedHintLabel(hint) {
  if (!hint) return null;
  if (hint.source === 'omlx') {
    const prefix = hint.confidence === 'exact' ? 'Observed' : 'Nearby';
    return `${prefix} ~${Math.round(hint.tgTps)} tok/s · oMLX ${Math.round(hint.contextTokens / 1024)}k`;
  }
  if (hint.source === 'canirun') {
    return `Estimated ~${Math.round(hint.tgTps)} tok/s · CanIRun`;
  }
  return null;
}

function compareOmlxHints(a, b, hardware) {
  const chip = normalizeChip(hardware.chip);
  const exactA = normalizeChip(a.chip) === chip ? 1 : 0;
  const exactB = normalizeChip(b.chip) === chip ? 1 : 0;
  if (exactB !== exactA) return exactB - exactA;
  const tierDeltaA = TIER_ORDER[deriveBandwidthTier(chip)] - TIER_ORDER[deriveBandwidthTier(a.chip)];
  const tierDeltaB = TIER_ORDER[deriveBandwidthTier(chip)] - TIER_ORDER[deriveBandwidthTier(b.chip)];
  if (tierDeltaA !== tierDeltaB) return tierDeltaA - tierDeltaB;
  const genDeltaA = Math.abs(chipGeneration(chip) - chipGeneration(a.chip));
  const genDeltaB = Math.abs(chipGeneration(chip) - chipGeneration(b.chip));
  if (genDeltaA !== genDeltaB) return genDeltaA - genDeltaB;
  return Math.abs(hardware.ramGb - a.ramGb) - Math.abs(hardware.ramGb - b.ramGb);
}

function findOmlxSpeedHint(row, hardware) {
  const hardwareTier = deriveBandwidthTier(hardware.chip);
  const candidates = OMLX_SPEED_HINTS
    .filter((hint) => hint.rowKey === row.key)
    .filter((hint) => hint.ramGb <= hardware.ramGb)
    .filter((hint) => TIER_ORDER[deriveBandwidthTier(hint.chip)] <= TIER_ORDER[hardwareTier])
    .sort((a, b) => compareOmlxHints(a, b, hardware));
  const hint = candidates[0];
  if (!hint) return null;
  const exact = normalizeChip(hint.chip) === normalizeChip(hardware.chip);
  return {
    source: 'omlx',
    confidence: exact ? 'exact' : 'nearby',
    usedForAdmission: false,
    tgTps: hint.tgTps,
    ppTps: hint.ppTps,
    contextTokens: hint.contextTokens,
    benchmarkChip: hint.chip,
    benchmarkRamGb: hint.ramGb,
    modelName: hint.modelName,
    observedAt: hint.observedAt,
    sourceUrl: hint.sourceUrl,
  };
}

function findCanIRunSpeedHint(row, hardware) {
  const mapping = CANIRUN_ADVISORY_MAP[row.key];
  if (!mapping) return null;
  const hardwareTier = deriveBandwidthTier(hardware.chip);
  const candidates = CANIRUN_SPEED_HINTS
    .filter((hint) => hint.rowKey === row.key)
    .filter((hint) => hint.ramGb <= hardware.ramGb)
    .filter((hint) => TIER_ORDER[deriveBandwidthTier(hint.chip)] <= TIER_ORDER[hardwareTier])
    .sort((a, b) => compareOmlxHints(a, b, hardware));
  const hint = candidates[0];
  if (!hint) return null;
  return {
    source: 'canirun',
    confidence: 'estimated',
    usedForAdmission: false,
    tgTps: hint.tgTps,
    benchmarkChip: hint.chip,
    benchmarkRamGb: hint.ramGb,
    modelId: row.modelId,
    modelSha256: row.modelSha256,
    modelName: row.name,
    quantization: mapping.quantization,
    observedAt: hint.observedAt,
    sourceUrl: 'https://canirun.ai/',
  };
}

function gradeFor(headroomGb, tierFits) {
  if (!tierFits) return { grade: 'T', fit: 'future', label: 'Needs higher tier' };
  if (headroomGb >= 16) return { grade: 'S', fit: 'great', label: 'Fits with headroom' };
  if (headroomGb >= 8) return { grade: 'A', fit: 'good', label: 'Fits catalog' };
  if (headroomGb >= 0) return { grade: 'B', fit: 'tight', label: 'Tight fit' };
  return { grade: 'F', fit: 'future', label: 'Needs more RAM' };
}

function rowScore(row, verdict, headroomGb) {
  const fitBase = { great: 300, good: 240, tight: 180, future: 0 }[verdict.fit] ?? 0;
  const measured = row.provenance === 'measured_single_host' ? 30 : 0;
  return fitBase + Math.min(row.minRamGb, 64) + measured + Math.max(0, Math.min(headroomGb, 32));
}

export function evaluateHostCompatibility(input = {}) {
  const chip = normalizeChip(input.chip);
  const ramGb = Number(input.ramGb);
  if (!Number.isFinite(ramGb) || ramGb < 4 || ramGb > 512) {
    const err = new Error('ramGb must be a number from 4 to 512');
    err.statusCode = 400;
    err.code = 'invalid_ram_gb';
    throw err;
  }

  const roundedRamGb = Math.round(ramGb);
  const bandwidthTier = deriveBandwidthTier(chip);
  const usableRamGb = Math.max(0, roundedRamGb - SAFETY_MARGIN_GB);

  const rows = HOST_CATALOG.rows.map((row) => {
    const headroomGb = usableRamGb - row.minRamGb;
    const tierFits = TIER_ORDER[bandwidthTier] >= TIER_ORDER[row.minBandwidthTier];
    const verdict = gradeFor(headroomGb, tierFits);
    const advisorySpeed = findOmlxSpeedHint(row, { chip, ramGb: roundedRamGb });
    return {
      ...row,
      grade: verdict.grade,
      fit: verdict.fit,
      label: verdict.label,
      headroomGb,
      tierFits,
      eligiblePreview: verdict.fit !== 'future',
      advisorySpeed,
      speedLabel: speedHintLabel(advisorySpeed),
      score: rowScore(row, verdict, headroomGb),
    };
  }).sort((a, b) => {
    if (b.eligiblePreview !== a.eligiblePreview) return Number(b.eligiblePreview) - Number(a.eligiblePreview);
    return b.score - a.score || a.name.localeCompare(b.name);
  });
  const compatibleRows = rows.filter((row) => row.eligiblePreview);
  const maxCatalogMinRamGb = HOST_CATALOG.rows.reduce((max, row) => Math.max(max, row.minRamGb), 0);
  let catalogCeiling = {
    state: 'within_current_preview',
    message: 'Preview is scoped to the current Malibu candidate snapshot and host recommendations.',
    maxCatalogMinRamGb,
  };
  if (usableRamGb > maxCatalogMinRamGb + 24 && compatibleRows.length === rows.length) {
    catalogCeiling = {
      state: 'above_current_preview',
      message: 'This Mac has more memory than the current public preview rows need; more catalog rows still require benchmark-backed Malibu host recommendations.',
      maxCatalogMinRamGb,
    };
  } else if (usableRamGb > maxCatalogMinRamGb + 24) {
    catalogCeiling = {
      state: 'high_memory_tier_limited',
      message: 'This Mac has more memory than the current preview rows need, but some rows still require a Pro, Max, or Ultra-class Mac.',
      maxCatalogMinRamGb,
    };
  }

  return {
    catalog: {
      releaseId: HOST_CATALOG.releaseId,
      generatedAt: HOST_CATALOG.generatedAt,
      policyVersion: HOST_CATALOG.policyVersion,
      candidateCatalogSha256: HOST_CATALOG.candidateCatalogSha256,
      candidateCatalogPath: HOST_CATALOG.candidateCatalogPath,
      signaturePath: HOST_CATALOG.signaturePath,
      signerKeyId: HOST_CATALOG.signerKeyId,
      source: HOST_CATALOG.source,
    },
    hardware: {
      chip,
      ramGb: roundedRamGb,
      usableRamGb,
      bandwidthTier,
      safetyMarginGb: SAFETY_MARGIN_GB,
    },
    compatibleCount: compatibleRows.length,
    catalogCeiling,
    rows,
  };
}

export async function enrichCompatibilityWithCanIRunSpeeds(result) {
  return {
    ...result,
    rows: result.rows.map((row) => {
      const advisorySpeed = row.advisorySpeed || (row.eligiblePreview ? findCanIRunSpeedHint(row, result.hardware) : null);
      return {
        ...row,
        advisorySpeed,
        speedLabel: speedHintLabel(advisorySpeed),
      };
    }),
  };
}
