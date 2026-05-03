import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/api/trpc";
import { useSettings } from "@/context/settings-context";

type Provider =
	| "anthropic"
	| "openai"
	| "gemini"
	| "mistral"
	| "ollama"
	| "openai-compatible";

const PROVIDERS: { key: Provider; label: string }[] = [
	{ key: "anthropic", label: "Anthropic" },
	{ key: "openai", label: "OpenAI" },
	{ key: "gemini", label: "Gemini" },
	{ key: "mistral", label: "Mistral" },
	{ key: "ollama", label: "Ollama" },
	{ key: "openai-compatible", label: "Compatible" },
];

const PLACEHOLDERS: Partial<Record<Provider, string>> = {
	anthropic: "sk-ant-...",
	openai: "sk-...",
	gemini: "Enter API key...",
	mistral: "Enter API key...",
	ollama: "http://localhost:11434",
	"openai-compatible": "Enter API key...",
};

const PROVIDER_NAMES: Record<Provider, string> = {
	anthropic: "ANTHROPIC",
	openai: "OPENAI",
	gemini: "GEMINI",
	mistral: "MISTRAL",
	ollama: "OLLAMA",
	"openai-compatible": "OPENAI-COMPATIBLE",
};

const DEFAULT_MODELS: Partial<Record<Provider, string>> = {
	anthropic: "claude-sonnet-4-20250514",
	openai: "gpt-4o-mini",
	gemini: "gemini-2.0-flash",
	mistral: "mistral-small-latest",
	ollama: "llama3.2",
	"openai-compatible": "gpt-4o-mini",
};

export function SettingsModal() {
	const { isOpen, close } = useSettings();
	const { data, refetch } = trpc.settings.get.useQuery();
	const setActiveProvider = trpc.settings.setActiveProvider.useMutation();
	const setProviderKey = trpc.settings.setProviderKey.useMutation();

	const [selectedProvider, setSelectedProvider] =
		useState<Provider>("anthropic");
	const [apiKey, setApiKey] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [model, setModel] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [saveStatus, setSaveStatus] = useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		if (data?.activeProvider) {
			setSelectedProvider(data.activeProvider as Provider);
		}
	}, [data?.activeProvider]);

	useEffect(() => {
		if (!isOpen) return;
		setApiKey("");
		setBaseUrl("");
		setModel("");
		setIsEditing(false);
		setSaveStatus("idle");
		setErrorMessage("");
		refetch();
	}, [isOpen, refetch]);

	useEffect(() => {
		setSaveStatus("idle");
		setErrorMessage("");
		setIsEditing(false);
		setApiKey("");
		setBaseUrl("");
		setModel("");
	}, [selectedProvider]);

	useEffect(() => {
		if (data?.providers?.[selectedProvider]?.model) {
			setModel(data.providers[selectedProvider].model as string);
		}
	}, [data, selectedProvider]);

	if (!isOpen) return null;

	const activeProvider = data?.activeProvider ?? null;
	const hasKey = data?.providers?.[selectedProvider]?.hasKey ?? false;
	const needsBaseUrl =
		selectedProvider === "ollama" || selectedProvider === "openai-compatible";
	const needsApiKey = selectedProvider !== "ollama";

	const handleSelectProvider = (provider: Provider) => {
		setSelectedProvider(provider);
		setActiveProvider.mutate({ provider });
	};

	const handleSave = () => {
		if (!needsApiKey && !apiKey && !baseUrl) return;
		setSaveStatus("saving");
		setErrorMessage("");

		setProviderKey.mutate(
			{
				provider: selectedProvider,
				apiKey: apiKey || "",
				baseUrl: needsBaseUrl ? baseUrl : undefined,
				model: model || undefined,
			},
			{
				onSuccess: () => {
					setSaveStatus("saved");
					setIsEditing(false);
					refetch();
					setTimeout(() => setSaveStatus("idle"), 2000);
				},
				onError: (err) => {
					setSaveStatus("error");
					setErrorMessage(err.message);
				},
			},
		);
	};

	const maskKey = () => {
		if (!needsApiKey) return null;
		const prefix =
			selectedProvider === "anthropic"
				? "sk-ant"
				: selectedProvider === "openai"
					? "sk"
					: "";
		return `${prefix}${prefix ? "-" : ""}••••••••••••`;
	};

	return (
		<div className="fixed inset-0 z-50">
			<button
				type="button"
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={close}
				aria-label="Close settings"
			/>
			<div className="absolute inset-0 flex items-start justify-center pt-[20vh]">
				<div className="slide-in-from-right relative w-full max-w-md animate-in rounded-sm border border-[#2a2a2a] bg-[#111111] p-6 font-mono duration-200">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="font-semibold text-[#e8e8e8] text-sm">Settings</h2>
						<button
							type="button"
							onClick={close}
							className="flex size-6 items-center justify-center rounded text-[#666666] hover:bg-[#1a1a1a] hover:text-[#cccccc]"
						>
							<X className="size-3.5" />
						</button>
					</div>

					<div className="mb-4 flex gap-0.5 overflow-x-auto">
						{PROVIDERS.map((p) => (
							<button
								type="button"
								key={p.key}
								onClick={() => handleSelectProvider(p.key)}
								className={`shrink-0 rounded-sm px-2.5 py-1 text-[10px] transition-colors ${
									selectedProvider === p.key
										? "border border-accent/30 bg-accent/10 text-accent"
										: "text-[#666666] hover:bg-[#1a1a1a] hover:text-[#cccccc]"
								}`}
							>
								{p.label}
							</button>
						))}
					</div>

					<div className="mb-3">
						<p className="mb-2 text-[#666666] text-[10px] uppercase tracking-widest">
							{PROVIDER_NAMES[selectedProvider]} SETTINGS
						</p>

						{needsApiKey && !isEditing && hasKey && (
							<div>
								<p className="font-mono text-[#888888] text-xs">{maskKey()}</p>
								{data?.providers?.[selectedProvider]?.model && (
									<p className="mt-0.5 font-mono text-[#666666] text-[10px]">
										Model: {data.providers[selectedProvider].model}
									</p>
								)}
								<button
									type="button"
									onClick={() => setIsEditing(true)}
									className="mt-1 text-[10px] text-accent hover:underline"
								>
									Change key
								</button>
							</div>
						)}

						{(isEditing || !hasKey) && (
							<div className="space-y-2">
								{needsApiKey && (
									<input
										type="password"
										value={apiKey}
										onChange={(e) => setApiKey(e.target.value)}
										placeholder={
											PLACEHOLDERS[selectedProvider] ?? "Enter API key..."
										}
										className="w-full rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 font-mono text-[#e8e8e8] text-xs focus:border-accent focus:outline-none"
									/>
								)}
								<input
									type="text"
									value={model}
									onChange={(e) => setModel(e.target.value)}
									placeholder={
										DEFAULT_MODELS[selectedProvider]
											? `Default: ${DEFAULT_MODELS[selectedProvider]}`
											: "Model..."
									}
									className="w-full rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 font-mono text-[#e8e8e8] text-xs focus:border-accent focus:outline-none"
								/>
								{needsBaseUrl && (
									<input
										type="text"
										value={baseUrl}
										onChange={(e) => setBaseUrl(e.target.value)}
										placeholder={PLACEHOLDERS.ollama}
										className="w-full rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 font-mono text-[#e8e8e8] text-xs focus:border-accent focus:outline-none"
									/>
								)}
								<button
									type="button"
									onClick={handleSave}
									disabled={saveStatus === "saving"}
									className="rounded-sm bg-[#00c27a] px-4 py-1.5 font-mono font-semibold text-black text-xs hover:opacity-90 disabled:opacity-50"
								>
									{saveStatus === "saving" ? "Saving..." : "Save"}
								</button>
								{saveStatus === "saved" && (
									<span className="ml-2 text-[#00c27a] text-[10px]">
										✓ Saved
									</span>
								)}
								{saveStatus === "error" && (
									<span className="ml-2 text-[#ff4444] text-[10px]">
										{errorMessage}
									</span>
								)}
							</div>
						)}
					</div>

					<p className="mt-1 text-[#555555] text-[10px]">
						Required for AI features.
					</p>

					{activeProvider && (
						<p className="mt-3 text-[#555555] text-[10px]">
							Active Provider:{" "}
							{PROVIDERS.find((p) => p.key === activeProvider)?.label ??
								activeProvider}
						</p>
					)}

					<p className="mt-4 font-mono text-[#444444] text-[10px]">
						Stored locally in .rlsmon/settings.json · Never transmitted except
						to selected provider API
					</p>
				</div>
			</div>
		</div>
	);
}
