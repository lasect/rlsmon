import { Database, LogIn, ShieldOff, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleData {
	name: string;
	isSuperuser: boolean;
	canLogin: boolean;
	memberOf: string[];
}

interface RiskFinding {
	severity: "critical" | "warning" | "info";
	title: string;
	description: string;
}

interface RiskIndicatorsProps {
	role: RoleData;
	allRoles: RoleData[];
}

export function RiskIndicators({ role, allRoles }: RiskIndicatorsProps) {
	const findings: RiskFinding[] = [];

	if (role.isSuperuser && role.canLogin) {
		findings.push({
			severity: "critical",
			title: "Superuser with login",
			description:
				"Can connect directly and has unrestricted access to all database objects, bypassing all RLS policies.",
		});
	}

	const inheritsFromSuperuser = role.memberOf.some((parent) => {
		const p = allRoles.find((r) => r.name === parent);
		return p?.isSuperuser;
	});
	if (inheritsFromSuperuser && !role.isSuperuser) {
		findings.push({
			severity: "critical",
			title: "Inherits superuser privileges",
			description:
				"Member of a superuser role. Effectively has full database access through inheritance.",
		});
	}

	if (role.isSuperuser && !role.canLogin) {
		findings.push({
			severity: "warning",
			title: "Superuser without login",
			description:
				"Has full privileges but cannot connect directly. Risk if membership grants login through another role.",
		});
	}

	const hasLoginViaInheritance = role.memberOf.some((parent) => {
		const p = allRoles.find((r) => r.name === parent);
		return p?.canLogin;
	});
	if (hasLoginViaInheritance && !role.canLogin) {
		findings.push({
			severity: "warning",
			title: "Login via inheritance",
			description:
				"Cannot login directly but inherits login capability from a parent role.",
		});
	}

	const childRoles = allRoles.filter((r) => r.memberOf.includes(role.name));
	const hasLoginChild = childRoles.some((c) => c.canLogin);
	if (role.isSuperuser && hasLoginChild && !role.canLogin) {
		const loginChildNames = childRoles
			.filter((c) => c.canLogin)
			.map((c) => c.name);
		findings.push({
			severity: "warning",
			title: "Superuser inherited by login role",
			description: `Cannot login directly, but ${loginChildNames.join(", ")} can login and inherit these superuser privileges.`,
		});
	}

	if (findings.length === 0) {
		return (
			<div className="rounded-md border border-border/50 bg-muted/10 p-3">
				<div className="flex items-center gap-2">
					<ShieldOff className="size-3.5 text-rls-grant" />
					<span className="font-medium text-[11px] text-rls-grant">
						No risk indicators detected
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-1.5">
			{findings.map((f) => (
				<div
					key={f.title}
					className={cn(
						"rounded-md border p-2.5",
						f.severity === "critical"
							? "border-rls-deny-muted/50 bg-rls-deny-muted/10"
							: f.severity === "warning"
								? "border-rls-warning-muted/50 bg-rls-warning-muted/10"
								: "border-rls-info-muted/50 bg-rls-info-muted/10",
					)}
				>
					<div className="flex items-start gap-2">
						<div className="mt-0.5 shrink-0">
							{f.severity === "critical" && (
								<Database className="size-3 text-rls-deny" />
							)}
							{f.severity === "warning" && (
								<UserPlus className="size-3 text-rls-warning" />
							)}
							{f.severity === "info" && (
								<LogIn className="size-3 text-rls-info" />
							)}
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-1.5">
								<span
									className={cn(
										"font-medium text-[11px]",
										f.severity === "critical"
											? "text-rls-deny"
											: f.severity === "warning"
												? "text-rls-warning"
												: "text-rls-info",
									)}
								>
									{f.title}
								</span>
								<span
									className={cn(
										"rounded px-1 py-px font-medium text-[9px] uppercase",
										f.severity === "critical"
											? "bg-rls-deny-muted/30 text-rls-deny"
											: f.severity === "warning"
												? "bg-rls-warning-muted/30 text-rls-warning"
												: "bg-rls-info-muted/30 text-rls-info",
									)}
								>
									{f.severity}
								</span>
							</div>
							<p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">
								{f.description}
							</p>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
