import { Outlet } from "react-router-dom";
import { BottomStatusBar } from "@/components/layout/bottom-status-bar";
import { TopBar } from "@/components/layout/top-bar";
import { Sidebar } from "@/components/sidebar/sidebar";

export function AppShell() {
	return (
		<div className="flex h-svh flex-col">
			<div className="flex flex-1 overflow-hidden">
				<Sidebar />
				<div className="flex flex-1 flex-col overflow-hidden">
					<TopBar />
					<main className="flex-1 overflow-auto bg-background">
						<Outlet />
					</main>
					<BottomStatusBar />
				</div>
			</div>
		</div>
	);
}
