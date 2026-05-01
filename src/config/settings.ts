// Basic obfuscation only — do not commit .rlsmon/ to git
import * as fs from "node:fs";
import * as path from "node:path";

export type Provider =
	| "anthropic"
	| "openai"
	| "gemini"
	| "mistral"
	| "ollama"
	| "openai-compatible";

export type ProviderConfig = {
	apiKey?: string;
	baseUrl?: string;
	model?: string;
};

export type Settings = {
	providers?: Partial<Record<Provider, ProviderConfig>>;
	activeProvider?: Provider;
	updatedAt?: string;
};

function getSettingsPath(): string {
	return path.join(process.cwd(), ".rlsmon", "settings.json");
}

function ensureSettingsDir(): void {
	fs.mkdirSync(path.join(process.cwd(), ".rlsmon"), { recursive: true });
}

function encode(value: string): string {
	return Buffer.from(value).toString("base64");
}

function decode(value: string): string {
	return Buffer.from(value, "base64").toString("utf-8");
}

export function readSettings(): Settings {
	const filePath = getSettingsPath();
	if (!fs.existsSync(filePath)) {
		return {};
	}
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const parsed = JSON.parse(content) as Settings;
		if (parsed.providers) {
			for (const [, config] of Object.entries(parsed.providers)) {
				if (config.apiKey) {
					try {
						config.apiKey = decode(config.apiKey);
					} catch {
						// key was not encoded, leave as-is
					}
				}
			}
		}
		return parsed;
	} catch {
		return {};
	}
}

export function writeSettings(settings: Settings): void {
	ensureSettingsDir();
	const existing = readSettings();
	const providers = {
		...existing.providers,
		...settings.providers,
	};
	for (const [, config] of Object.entries(providers)) {
		if (config?.apiKey) {
			config.apiKey = encode(config.apiKey);
		}
	}
	const merged: Settings = {
		...existing,
		...settings,
		providers,
		updatedAt: new Date().toISOString(),
	};
	const filePath = getSettingsPath();
	fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
}

export function isValidKey(provider: Provider, apiKey: string): boolean {
	switch (provider) {
		case "anthropic":
			return apiKey.startsWith("sk-ant-");
		case "openai":
			return apiKey.startsWith("sk-");
		case "ollama":
			return true;
		case "openai-compatible":
			return apiKey.length > 10;
		case "gemini":
		case "mistral":
			return apiKey.length > 20;
	}
}
