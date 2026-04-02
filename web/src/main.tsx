import { createRoot } from "react-dom/client";

import "./index.css";
import { TRPCProvider } from "@/api/provider.tsx";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
	<TRPCProvider>
		<ThemeProvider>
			<App />
		</ThemeProvider>
	</TRPCProvider>,
);
