import { readSettings } from "../config/settings";

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
			return createAnthropicClient(key);
		}
		case "openai": {
			const key = apiKey as string;
			return createOpenAIClient(
				"https://api.openai.com/v1/chat/completions",
				key,
				"gpt-4o-mini",
			);
		}
		case "groq": {
			const key = apiKey as string;
			return createOpenAIClient(
				"https://api.groq.com/openai/v1/chat/completions",
				key,
				"llama-3.3-70b-versatile",
			);
		}
		case "mistral": {
			const key = apiKey as string;
			return createOpenAIClient(
				"https://api.mistral.ai/v1/chat/completions",
				key,
				"mistral-small-latest",
			);
		}
		case "gemini": {
			const key = apiKey as string;
			return createGeminiClient(key);
		}
		case "ollama":
			return createOllamaClient(baseUrl || "http://localhost:11434");
		case "openai-compatible":
			return createOpenAIClient(
				`${baseUrl || "http://localhost:11434/v1"}/chat/completions`,
				apiKey || "",
				"gpt-4o-mini",
			);
		default:
			throw new Error(`Unknown AI provider: ${provider}`);
	}
}

// Anthropic client
function createAnthropicClient(apiKey: string): { generate: GenerateFn } {
	return {
		generate: async (prompt: string) => {
			const response = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: "claude-sonnet-4-5-20250929",
					max_tokens: 1024,
					messages: [{ role: "user", content: prompt }],
				}),
			});
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

// OpenAI-compatible client (OpenAI, Groq, Mistral, OpenAI-compatible)
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
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: prompt }],
					max_tokens: 1024,
				}),
			});
			const data = (await response.json()) as {
				choices: Array<{ message: { content: string } }>;
				error?: { message: string };
			};
			if (data.error) {
				throw new Error(data.error.message);
			}
			if (!data.choices?.[0]?.message) {
				throw new Error(
					"Unexpected response format from OpenAI-compatible API",
				);
			}
			return data.choices[0].message.content;
		},
	};
}

// Gemini client
function createGeminiClient(apiKey: string): { generate: GenerateFn } {
	return {
		generate: async (prompt: string) => {
			const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
			const response = await fetch(url, {
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
function createOllamaClient(baseUrl: string): { generate: GenerateFn } {
	return {
		generate: async (prompt: string) => {
			const response = await fetch(`${baseUrl}/api/generate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "llama3.2",
					prompt,
					stream: false,
				}),
			});
			const data = (await response.json()) as {
				response: string;
				error?: string;
			};
			if (data.error) {
				throw new Error(data.error);
			}
			return data.response;
		},
	};
}
