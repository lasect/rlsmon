import { Outlet } from "react-router-dom";
import { TopBar } from "@/components/layout/top-bar";

export function AppShell() {
	return (
		<div className="h-screen overflow-hidden bg-background">
			<TopBar />
			<main className="mt-10 h-[calc(100vh-40px)] flex flex-col overflow-hidden bg-background">
				<Outlet />
			</main>
		</div>
	);
}
