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
import { Link, useLocation } from "react-router-dom";
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
		<Link
			to={item.href}
			className={cn(
				"flex items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
				isActive &&
					"border-sidebar-primary border-l-2 bg-sidebar-accent pl-[6px] font-medium text-sidebar-accent-foreground",
				!isActive && "border-transparent border-l-2",
			)}
		>
			<item.icon className="size-3.5 shrink-0" />
			<span>{item.label}</span>
		</Link>
	);
}

export function Sidebar() {
	const location = useLocation();

	return (
		<aside className="flex h-full w-48 flex-col border-border border-r bg-sidebar">
			<div className="flex h-10 items-center border-sidebar-border border-b px-3">
				<span className="font-mono font-semibold text-sidebar-foreground text-xs tracking-tight">
					RLSMon
				</span>
			</div>
			<nav className="flex-1 overflow-y-auto px-2 py-2">
				{navGroups.map((group) => (
					<div key={group.label} className="mb-3">
						<div className="mb-1 px-2 font-medium text-[10px] text-sidebar-foreground/40 uppercase tracking-wider">
							{group.label}
						</div>
						<div className="space-y-px">
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
			<div className="border-sidebar-border border-t p-2">
				<Link
					to="/settings"
					className={cn(
						"flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
						location.pathname === "/settings" &&
							"border-sidebar-primary border-l-2 bg-sidebar-accent pl-[6px] font-medium text-sidebar-accent-foreground",
						location.pathname !== "/settings" &&
							"border-transparent border-l-2",
					)}
				>
					<Settings className="size-3.5 shrink-0" />
					<span>Settings</span>
				</Link>
			</div>
		</aside>
	);
}
