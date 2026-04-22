import {
	Camera,
	ClipboardCheck,
	GitBranch,
	Grid3x3,
	Rows3,
	ScrollText,
	Settings,
	ShieldAlert,
	Sparkles,
	Terminal,
	UserCircle,
	Users,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItem {
	label: string;
	href: string;
	icon: React.ElementType;
}

interface NavGroup {
	label: string;
	hasBorder?: boolean;
	items: NavItem[];
}

const navGroups: NavGroup[] = [
	{
		label: "EXPLORE",
		items: [
			{ label: "Matrix", href: "/explore/matrix", icon: Grid3x3 },
			{ label: "Policies", href: "/explore/policies", icon: ScrollText },
			{ label: "Roles", href: "/explore/roles", icon: Users },
			{ label: "Row Access", href: "/explore/row-access", icon: Rows3 },
		],
	},
	{
		label: "SIMULATE",
		hasBorder: true,
		items: [{ label: "Persona", href: "/simulate", icon: UserCircle }],
	},
	{
		label: "AUDIT",
		hasBorder: true,
		items: [
			{ label: "Overview", href: "/audit", icon: ShieldAlert },
			{ label: "CI Mode", href: "/audit/ci", icon: Terminal },
		],
	},
	{
		label: "AI",
		hasBorder: true,
		items: [{ label: "Tools", href: "/ai", icon: Sparkles }],
	},
	{
		label: "HISTORY",
		hasBorder: true,
		items: [
			{ label: "Snapshots", href: "/history", icon: Camera },
			{ label: "Diff Viewer", href: "/history/diff", icon: GitBranch },
			{
				label: "Migration Check",
				href: "/history/migration",
				icon: ClipboardCheck,
			},
		],
	},
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
	const Icon = item.icon;
	return (
		<Link
			to={item.href}
			className={cn(
				"flex w-full items-center gap-2 rounded-md px-3 py-1 text-[13px] transition-colors",
				isActive
					? "bg-zinc-800 font-medium text-white"
					: "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100",
			)}
		>
			<Icon className="size-3.5 text-zinc-500" />
			<span>{item.label}</span>
		</Link>
	);
}

export function Sidebar() {
	const location = useLocation();

	return (
		<aside className="flex h-full w-52 flex-col border-zinc-800 border-r bg-surface">
			<nav className="flex-1 overflow-y-auto px-2">
				{navGroups.map((group) => (
					<div key={group.label}>
						<div
							className={cn(
								"mb-1 select-none px-3 font-mono text-[10px] text-zinc-600/70 uppercase tracking-[0.12em]",
								group.hasBorder
									? "mt-1 border-zinc-800/60 border-t pt-2 pb-0.5"
									: "pt-4 pb-0.5",
							)}
						>
							{group.label}
						</div>
						<div className="space-y-1">
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
			<div className="border-zinc-800/60 border-t px-2 pt-2 pb-2">
				<Link
					to="/settings"
					className={cn(
						"flex w-full items-center gap-2 rounded-md px-3 py-1 text-[13px] transition-colors",
						location.pathname === "/settings"
							? "bg-zinc-800 font-medium text-white"
							: "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100",
					)}
				>
					<Settings className="size-3.5" />
					<span>Settings</span>
				</Link>
			</div>
		</aside>
	);
}
