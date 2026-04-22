import { Outlet } from "react-router-dom";
import { TopBar } from "@/components/layout/top-bar";
import { Sidebar } from "@/components/sidebar/sidebar";

export function AppShell() {
	return (
		<div className="flex h-screen flex-col overflow-hidden">
			<TopBar />
			<div className="flex flex-1 overflow-hidden">
				<Sidebar />
				<main className="flex flex-1 flex-col overflow-hidden bg-background">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
