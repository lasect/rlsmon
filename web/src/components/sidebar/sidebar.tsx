import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItem {
	label: string;
	href: string;
}

interface NavGroup {
	label: string;
	items: NavItem[];
}

const navGroups: NavGroup[] = [
	{
		label: "// explore",
		items: [
			{ label: "Matrix", href: "/explore/matrix" },
			{ label: "Policies", href: "/explore/policies" },
			{ label: "Roles", href: "/explore/roles" },
			{ label: "Row Access", href: "/explore/row-access" },
		],
	},
	{
		label: "// simulate",
		items: [{ label: "Persona", href: "/simulate" }],
	},
	{
		label: "// audit",
		items: [
			{ label: "Overview", href: "/audit" },
			{ label: "CI Mode", href: "/audit/ci" },
		],
	},
	{
		label: "// ai",
		items: [{ label: "Tools", href: "/ai" }],
	},
	{
		label: "// history",
		items: [
			{ label: "Snapshots", href: "/history" },
			{ label: "Diff Viewer", href: "/history/diff" },
			{
				label: "Migration Check",
				href: "/history/migration",
			},
		],
	},
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
	return (
		<Link
			to={item.href}
			className={cn(
				"block w-full rounded-sm px-3 py-1.5 font-mono text-[11px] transition-colors",
				isActive
					? "border-accent border-l-2 bg-accent-glow pl-[10px] text-accent"
					: "border-transparent border-l-2 text-text-muted hover:bg-surface-raised hover:text-text",
			)}
		>
			{item.label}
		</Link>
	);
}

export function Sidebar() {
	const location = useLocation();

	return (
		<aside className="flex h-full w-[200px] flex-col border-border border-r bg-surface">
			<div className="flex flex-col border-border border-b px-3 py-3">
				<span className="font-bold font-mono text-accent text-sm">RLSMon</span>
				<span className="mt-1 truncate font-mono text-[10px] text-text-dim">
					localhost:5432
				</span>
			</div>
			<nav className="flex-1 overflow-y-auto px-2 py-2">
				{navGroups.map((group) => (
					<div key={group.label} className="mb-3">
						<div className="mb-1 pl-3 font-mono text-[10px] text-text-dim uppercase tracking-widest">
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
			<div className="border-border border-t p-2">
				<Link
					to="/settings"
					className={cn(
						"block w-full rounded-sm px-3 py-1.5 font-mono text-[11px] transition-colors",
						location.pathname === "/settings"
							? "border-accent border-l-2 bg-accent-glow pl-[10px] text-accent"
							: "border-transparent border-l-2 text-text-muted hover:bg-surface-raised hover:text-text",
					)}
				>
					Settings
				</Link>
			</div>
		</aside>
	);
}
