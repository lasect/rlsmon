import { z } from "zod";
import {
	isValidKey,
	type Provider,
	readSettings,
	writeSettings,
} from "../../config/settings";
import { publicProcedure, router } from "../trpc";

const providerSchema = z.enum([
	"anthropic",
	"openai",
	"gemini",
	"mistral",
	"ollama",
	"openai-compatible",
]);

export const settingsRouter = router({
	get: publicProcedure.query(() => {
		const settings = readSettings();
		const providers = {} as Record<Provider, { hasKey: boolean }>;
		if (settings.providers) {
			for (const key of providerSchema.options) {
				const config = settings.providers[key];
				providers[key] = {
					hasKey: !!(config?.apiKey && config.apiKey.length > 0),
				};
			}
		} else {
			for (const key of providerSchema.options) {
				providers[key] = { hasKey: false };
			}
		}
		return {
			providers,
			activeProvider: settings.activeProvider ?? null,
		};
	}),

	setProviderKey: publicProcedure
		.input(
			z.object({
				provider: providerSchema,
				apiKey: z.string().min(1),
				baseUrl: z.string().optional(),
			}),
		)
		.mutation(({ input }) => {
			if (!isValidKey(input.provider, input.apiKey)) {
				throw new Error(`Invalid API key format for ${input.provider}`);
			}
			writeSettings({
				providers: {
					[input.provider]: {
						apiKey: input.apiKey,
						baseUrl: input.baseUrl,
					},
				},
			});
			return { success: true };
		}),

	setActiveProvider: publicProcedure
		.input(
			z.object({
				provider: providerSchema,
			}),
		)
		.mutation(({ input }) => {
			writeSettings({
				activeProvider: input.provider,
			});
			return { success: true };
		}),
});
