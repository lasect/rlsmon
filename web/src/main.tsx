import { createRoot } from "react-dom/client";

import "./index.css";
import { TRPCProvider } from "@/api/provider.tsx";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersonaProvider } from "@/context/persona-context.tsx";
import { SettingsProvider } from "@/context/settings-context.tsx";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
	<TRPCProvider>
		<ThemeProvider>
			<SettingsProvider>
				<PersonaProvider>
					<TooltipProvider delayDuration={200}>
						<App />
					</TooltipProvider>
				</PersonaProvider>
			</SettingsProvider>
		</ThemeProvider>
	</TRPCProvider>,
);
