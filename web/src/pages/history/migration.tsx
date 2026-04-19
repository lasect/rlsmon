import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { MigrationCheckPanel } from "@/components/migration/MigrationCheckPanel";

export function MigrationCheckPage() {
	return (
		<div className="flex h-full flex-col overflow-hidden px-4 pt-3 pb-4">
			<div className="flex items-center gap-2">
				<Link
					to="/history"
					className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-4" />
					Snapshots
				</Link>
			</div>

			<div className="mt-3">
				<h1 className="font-semibold text-sm">Migration Safety Check</h1>
				<p className="mt-0.5 text-muted-foreground text-xs">
					Check if your migration touches RLS-protected tables
				</p>
			</div>

			<div className="mt-3 flex-1 overflow-hidden">
				<MigrationCheckPanel mode="full" />
			</div>
		</div>
	);
}
