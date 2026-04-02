import type { LucideIcon } from "lucide-react";
import {
	ClipboardList,
	Cpu,
	GitCompare,
	History,
	KeyRound,
	LayoutGrid,
	Play,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItem {
	label: string;
	href: string;
	icon: LucideIcon;
}

interface NavGroup {
	label: string;
	items: NavItem[];
}

const navGroups: NavGroup[] = [
	{
		label: "Explore",
		items: [
			{ label: "Matrix", href: "/explore/matrix", icon: LayoutGrid },
			{ label: "Policies", href: "/explore/policies", icon: Shield },
			{ label: "Roles", href: "/explore/roles", icon: Users },
			{ label: "Row Access", href: "/explore/row-access", icon: KeyRound },
		],
	},
	{
		label: "Simulate",
		items: [{ label: "Persona", href: "/simulate", icon: Play }],
	},
	{
		label: "Audit",
		items: [
			{ label: "Overview", href: "/audit", icon: ClipboardList },
			{ label: "CI Mode", href: "/audit/ci", icon: Cpu },
		],
	},
	{
		label: "AI",
		items: [{ label: "Tools", href: "/ai", icon: Cpu }],
	},
	{
		label: "History",
		items: [
			{ label: "Snapshots", href: "/history", icon: History },
			{ label: "Diff Viewer", href: "/history/diff", icon: GitCompare },
		],
	},
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
	return (
		<a
			href={item.href}
			className={cn(
				"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
				isActive && "bg-muted font-medium",
			)}
		>
			<item.icon className="size-4 shrink-0" />
			<span>{item.label}</span>
		</a>
	);
}

export function Sidebar() {
	const location = useLocation();

	return (
		<aside className="flex h-full w-56 flex-col border-border border-r bg-sidebar">
			<div className="flex h-12 items-center border-sidebar-border border-b px-4">
				<span className="font-mono font-semibold text-sm tracking-tight">
					RLSMon
				</span>
			</div>
			<nav className="flex-1 overflow-y-auto p-3">
				{navGroups.map((group) => (
					<div key={group.label} className="mb-4">
						<div className="mb-1.5 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							{group.label}
						</div>
						<div className="space-y-0.5">
							{group.items.map((item) => (
								<NavLink
									key={item.href}
									item={item}
									isActive={location.pathname === item.href}
								/>
							))}
						</div>
					</div>
				))}
			</nav>
			<div className="border-sidebar-border border-t p-3">
				<a
					href="/settings"
					className={cn(
						"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
						location.pathname === "/settings" && "bg-muted font-medium",
					)}
				>
					<Settings className="size-4 shrink-0" />
					<span>Settings</span>
				</a>
			</div>
		</aside>
	);
}
