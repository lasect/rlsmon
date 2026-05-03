import { readSettings } from "../config/settings";

const FETCH_TIMEOUT_MS = 120_000;

type GenerateFn = (prompt: string) => Promise<string>;

export function getAIClient(): { generate: GenerateFn } {
	const settings = readSettings();
	const provider = settings.activeProvider;

	if (!provider) {
		throw new Error("No AI provider configured. Set one in Settings.");
	}

	const config = settings.providers?.[provider];
	const apiKey = config?.apiKey;
	const baseUrl = config?.baseUrl;

	if (provider !== "ollama" && provider !== "openai-compatible" && !apiKey) {
		throw new Error(`API key required for ${provider}. Set it in Settings.`);
	}

	switch (provider) {
		case "anthropic": {
			const key = apiKey as string;
			const modelName = config?.model || "claude-sonnet-4-20250514";
			return createAnthropicClient(key, modelName);
		}
		case "openai": {
			const key = apiKey as string;
			const modelName = config?.model || "gpt-4o-mini";
			return createOpenAIClient(
				"https://api.openai.com/v1/chat/completions",
				key,
				modelName,
			);
		}
		case "mistral": {
			const key = apiKey as string;
			const modelName = config?.model || "mistral-small-latest";
			return createOpenAIClient(
				"https://api.mistral.ai/v1/chat/completions",
				key,
				modelName,
			);
		}
		case "gemini": {
			const key = apiKey as string;
			const modelName = config?.model || "gemini-2.0-flash";
			return createGeminiClient(key, modelName);
		}
		case "ollama": {
			const modelName = config?.model || "llama3.2";
			return createOllamaClient(baseUrl || "http://localhost:11434", modelName);
		}
		case "openai-compatible": {
			const modelName = config?.model || "gpt-4o-mini";
			return createOpenAIClient(
				`${baseUrl || "http://localhost:11434/v1"}/chat/completions`,
				apiKey || "",
				modelName,
			);
		}
		default:
			throw new Error(`Unknown AI provider: ${provider}`);
	}
}

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	return fetch(url, { ...init, signal: controller.signal }).finally(() =>
		clearTimeout(id),
	);
}

// Anthropic client
function createAnthropicClient(
	apiKey: string,
	model: string,
): { generate: GenerateFn } {
	return {
		generate: async (prompt: string) => {
			const response = await fetchWithTimeout(
				"https://api.anthropic.com/v1/messages",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": apiKey,
						"anthropic-version": "2023-06-01",
					},
					body: JSON.stringify({
						model,
						max_tokens: 1024,
						messages: [{ role: "user", content: prompt }],
					}),
				},
			);
			const data = (await response.json()) as {
				content: Array<{ text: string }>;
				error?: { message: string };
			};
			if (data.error) {
				throw new Error(data.error.message);
			}
			if (!data.content?.[0]) {
				throw new Error("Unexpected response format from Anthropic API");
			}
			return data.content[0].text;
		},
	};
}

// OpenAI-compatible client (OpenAI, Mistral, OpenAI-compatible)
function createOpenAIClient(
	url: string,
	apiKey: string,
	model: string,
): { generate: GenerateFn } {
	return {
		generate: async (prompt: string) => {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (apiKey) {
				headers.Authorization = `Bearer ${apiKey}`;
			}
			const response = await fetchWithTimeout(url, {
				method: "POST",
				headers,
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: prompt }],
					max_tokens: 1024,
				}),
			});
			if (!response.ok) {
				const text = await response.text();
				throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
			}
			const data = (await response.json()) as {
				choices: Array<{ message: { content: string | null } }>;
				error?: { message: string };
			};
			if (data.error) {
				throw new Error(data.error.message);
			}
			const content = data.choices?.[0]?.message?.content;
			if (typeof content !== "string" || content.length === 0) {
				throw new Error(
					"Unexpected response format from OpenAI-compatible API: empty or missing content",
				);
			}
			return content;
		},
	};
}

// Gemini client
function createGeminiClient(
	apiKey: string,
	model: string,
): { generate: GenerateFn } {
	return {
		generate: async (prompt: string) => {
			const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
			const response = await fetchWithTimeout(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						maxOutputTokens: 1024,
					},
				}),
			});
			if (!response.ok) {
				const text = await response.text();
				throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
			}
			const data = (await response.json()) as {
				candidates: Array<{
					content: { parts: Array<{ text: string }> };
				}>;
				error?: { message: string };
			};
			if (data.error) {
				throw new Error(data.error.message);
			}
			if (!data.candidates?.[0]?.content?.parts?.[0]) {
				throw new Error("Unexpected response format from Gemini API");
			}
			return data.candidates[0].content.parts[0].text;
		},
	};
}

// Ollama client
function createOllamaClient(
	baseUrl: string,
	model: string,
): { generate: GenerateFn } {
	return {
		generate: async (prompt: string) => {
			const response = await fetchWithTimeout(`${baseUrl}/api/generate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model,
					prompt,
					stream: false,
				}),
			});
			if (!response.ok) {
				const text = await response.text();
				throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
			}
			const data = (await response.json()) as {
				response: string;
				error?: string;
			};
			if (data.error) {
				throw new Error(data.error);
			}
			if (typeof data.response !== "string" || data.response.length === 0) {
				throw new Error("Unexpected response format from Ollama API");
			}
			return data.response;
		},
	};
}
