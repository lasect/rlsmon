import { Outlet } from "react-router-dom";
import { BottomStatusBar } from "@/components/layout/bottom-status-bar";
import { TopBar } from "@/components/layout/top-bar";
import { Sidebar } from "@/components/sidebar/sidebar";

interface AppShellProps {
	connectionString?: string;
	isConnected?: boolean;
	persona?: {
		name: string;
		role?: string;
	} | null;
}

export function AppShell({
	connectionString,
	isConnected,
	persona,
}: AppShellProps) {
	return (
		<div className="flex h-svh flex-col">
			<div className="flex flex-1 overflow-hidden">
				<Sidebar />
				<div className="flex flex-1 flex-col overflow-hidden">
					<TopBar
						connectionString={connectionString}
						isConnected={isConnected}
					/>
					<main className="flex-1 overflow-auto bg-background p-6">
						<Outlet />
					</main>
					<BottomStatusBar persona={persona} />
				</div>
			</div>
		</div>
	);
}
