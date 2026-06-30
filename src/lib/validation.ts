import { z } from 'zod';

export const comfortTypeSchema = z.enum(['HOT_SENSITIVE', 'COLD_SENSITIVE', 'CROWD_AVOIDER', 'BALANCED']);
export const commuteTypeSchema = z.enum(['MORNING', 'EVENING', 'CUSTOM']);

export const recommendRequestSchema = z.object({
  line: z.string().min(1, '노선을 선택해 주세요.'),
  originStation: z.string().min(1, '출발역을 입력해 주세요.'),
  destinationStation: z.string().optional(),
  destinationLine: z.string().optional(),
  direction: z.string().optional(),
  comfortType: comfortTypeSchema.default('BALANCED'),
  targetTime: z.string().datetime({ offset: true }).optional(),
  waitToleranceMin: z.union([z.literal(0), z.literal(3), z.literal(5), z.literal(10)]).default(3),
  avoidPrioritySeatArea: z.boolean().default(true),
  anonymousId: z.string().uuid().optional(),
  transferStations: z.array(z.string().min(1)).max(5).optional(),
});

export const routePlansRequestSchema = z.object({
  line: z.string().optional(),
  originLine: z.string().optional(),
  originStation: z.string().min(1, '출발역을 선택해 주세요.'),
  destinationStation: z.string().min(1, '도착역을 선택해 주세요.'),
  destinationLine: z.string().optional(),
  direction: z.string().optional(),
  comfortType: comfortTypeSchema.default('HOT_SENSITIVE'),
  waitToleranceMin: z.union([z.literal(0), z.literal(3), z.literal(5), z.literal(10)]).default(3),
  avoidPrioritySeatArea: z.boolean().default(true),
  anonymousId: z.string().uuid().optional(),
  transferStations: z.array(z.string().min(1)).max(5).optional(),
  maxCandidates: z.number().int().min(1).max(6).optional(),
});

export const feedbackSchema = z.object({
  recommendationId: z.string().uuid().optional(),
  anonymousId: z.string().uuid().optional(),
  line: z.string().min(1),
  station: z.string().min(1),
  direction: z.string().optional(),
  carNo: z.number().int().min(1).max(12),
  feedbackType: z.enum(['GOOD', 'HOT', 'COLD', 'CROWDED', 'WRONG']),
  temperatureFeel: z.enum(['COOL', 'OK', 'HOT', 'COLD']).optional(),
  crowdingFeel: z.enum(['LOW', 'MID', 'HIGH']).optional(),
});

export const savedRouteSchema = z.object({
  anonymousId: z.string().uuid().optional(),
  label: z.string().max(40).optional(),
  originStation: z.string().min(1, '출발역을 입력해 주세요.'),
  destinationStation: z.string().optional(),
  line: z.string().min(1, '노선을 선택해 주세요.'),
  direction: z.string().optional(),
  comfortType: comfortTypeSchema.default('BALANCED'),
  commuteType: commuteTypeSchema.default('CUSTOM'),
  isDefault: z.boolean().default(false),
});
