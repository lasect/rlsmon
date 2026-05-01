import { Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSettings } from "@/context/settings-context";

const navItems = [
	{ label: "Audit", href: "/audit", activeFor: ["/audit", "/audit/ci"] },
	{
		label: "Policies",
		href: "/explore/policies",
		activeFor: ["/explore/policies"],
	},
	{ label: "Roles", href: "/explore/roles", activeFor: ["/explore/roles"] },
	{ label: "Simulate", href: "/simulate", activeFor: ["/simulate"] },
	{ label: "History", href: "/history", activeFor: ["/history", "/history/"] },
];

export function TopBar() {
	const location = useLocation();
	const navigate = useNavigate();
	const { open: openSettings } = useSettings();
	const isConnected = true;

	const isNavActive = (activeFor: string[]) => {
		return activeFor.some((path) => {
			if (path.endsWith("/")) {
				return location.pathname.startsWith(path);
			}
			return location.pathname === path;
		});
	};

	return (
		<header className="fixed top-0 right-0 left-0 z-50 flex h-10 w-full items-center justify-between border-[#222222] border-b bg-[#0d0d0d] px-3">
			{/* Left: Wordmark + host:port */}
			<div className="flex items-center">
				<button
					type="button"
					onClick={() => navigate("/audit")}
					className="cursor-pointer font-bold font-mono text-accent text-sm"
				>
					RLSMon
				</button>
				<span className="ml-2 text-[#555555] text-[10px]">|</span>
				<span className="ml-2 font-mono text-[#555555] text-[10px]">
					localhost:5432
				</span>
			</div>

			{/* Center: Navigation */}
			<nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
				{navItems.map((item) => {
					const active = isNavActive(item.activeFor);
					return (
						<button
							type="button"
							key={item.href}
							onClick={() => navigate(item.href)}
							className={
								active
									? "rounded-sm border-accent border-b-2 bg-accent/5 px-3 py-1 font-mono text-accent text-xs transition-colors"
									: "rounded-sm px-3 py-1 font-mono text-[#666666] text-xs transition-colors hover:bg-[#1a1a1a] hover:text-[#cccccc]"
							}
						>
							{item.label}
						</button>
					);
				})}
			</nav>

			{/* Right: settings + connection status */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={openSettings}
					className="cursor-pointer rounded p-0.5 text-[#666666] hover:bg-[#1a1a1a] hover:text-[#cccccc]"
					aria-label="Settings"
				>
					<Settings className="size-3.5" />
				</button>
				<div className="flex items-center gap-1.5">
					<span
						className="text-[10px]"
						style={{
							color: isConnected ? "var(--color-accent)" : "#ff4444",
						}}
					>
						●
					</span>
					<span
						className="font-mono text-[10px]"
						style={{
							color: isConnected ? "var(--color-accent)" : "#ff4444",
						}}
					>
						{isConnected ? "connected" : "disconnected"}
					</span>
				</div>
			</div>
		</header>
	);
}
