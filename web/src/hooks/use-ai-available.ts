import { trpc } from "@/api/trpc";
import { useSettings } from "@/context/settings-context";

export function useAiAvailable() {
	const { data: settings } = trpc.settings.get.useQuery();
	const { open } = useSettings();

	const available = Boolean(
		settings?.activeProvider &&
			(settings.activeProvider === "ollama" ||
				settings.providers?.[settings.activeProvider]?.hasKey),
	);

	return {
		available,
		openSettings: open,
	};
}
