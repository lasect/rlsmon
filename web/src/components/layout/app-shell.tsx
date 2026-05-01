import { Outlet } from "react-router-dom";
import { TopBar } from "@/components/layout/top-bar";
import { SettingsModal } from "@/components/settings-modal";

export function AppShell() {
	return (
		<div className="h-screen overflow-hidden bg-background">
			<TopBar />
			<main className="mt-10 flex h-[calc(100vh-40px)] flex-col overflow-hidden bg-background">
				<Outlet />
			</main>
			<SettingsModal />
		</div>
	);
}
