import { Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	AUDIT_CHECKS,
	AUDIT_PLACEHOLDER_RESULTS,
	type AuditFinding,
	type AuditFormat,
	buildAuditCommand,
	buildGithubActionsSnippet,
	copyText,
	type ExitCodeBehavior,
	type FailOnSeverity,
	formatGithubAnnotation,
	loadStoredAuditResults,
} from "@/lib/audit";
import { cn } from "@/lib/utils";

export function AuditCiPage() {
	const [failOn, setFailOn] = useState<FailOnSeverity>("critical");
	const [format, setFormat] = useState<AuditFormat>("pretty");
	const [selectedChecks, setSelectedChecks] = useState<string[]>([
		...AUDIT_CHECKS,
	]);
	const [exitCodeBehavior, setExitCodeBehavior] =
		useState<ExitCodeBehavior>("fail-on-findings");
	const [copied, setCopied] = useState<"command" | "yaml" | null>(null);
	const [storedFindings, setStoredFindings] = useState<AuditFinding[] | null>(
		() => loadStoredAuditResults()?.findings ?? null,
	);

	useEffect(() => {
		const handleStorage = () => {
			setStoredFindings(loadStoredAuditResults()?.findings ?? null);
		};

		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	const findings = storedFindings ?? AUDIT_PLACEHOLDER_RESULTS.findings;
	const command = useMemo(
		() =>
			buildAuditCommand({
				failOn,
				format,
				checks: selectedChecks,
				exitCodeBehavior,
			}),
		[exitCodeBehavior, failOn, format, selectedChecks],
	);
	const yamlSnippet = useMemo(
		() => buildGithubActionsSnippet(failOn),
		[failOn],
	);

	const handleCopy = async (type: "command" | "yaml", value: string) => {
		await copyText(value);
		setCopied(type);
		window.setTimeout(
			() => setCopied((current) => (current === type ? null : current)),
			1500,
		);
	};

	const toggleCheck = (check: string) => {
		setSelectedChecks((current) =>
			current.includes(check)
				? current.filter((item) => item !== check)
				: [...current, check],
		);
	};

	return (
		<div className="flex h-full flex-col overflow-auto px-4 pt-3 pb-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="mb-2">
						<Link
							to="/audit"
							className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
						>
							← Overview
						</Link>
					</div>
					<h1 className="font-semibold text-sm">CI Mode</h1>
					<p className="mt-0.5 text-[11px] text-muted-foreground">
						Run audits in your CI/CD pipeline
					</p>
				</div>

				<Button size="sm" onClick={() => handleCopy("command", command)}>
					{copied === "command" ? (
						<>
							<Check className="size-3.5" />
							Copied
						</>
					) : (
						<>
							<Copy className="size-3.5" />
							Copy Command
						</>
					)}
				</Button>
			</div>

			<div className="mt-4 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
				<div className="rounded-lg border border-border/70 bg-card p-4">
					<div className="space-y-5">
						<div className="space-y-2">
							<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Fail On
							</div>
							<Select
								value={failOn}
								onValueChange={(value) => setFailOn(value as FailOnSeverity)}
							>
								<SelectTrigger className="w-full text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(["critical", "warning", "info", "never"] as const).map(
										(value) => (
											<SelectItem key={value} value={value} className="text-xs">
												{value}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Output format
							</div>
							<div className="flex flex-wrap gap-1">
								{(["pretty", "json", "github"] as const).map((value) => (
									<button
										key={value}
										type="button"
										onClick={() => setFormat(value)}
										className={cn(
											"rounded-md border px-2.5 py-1 font-medium text-[11px] transition-colors",
											format === value
												? "border-primary bg-primary/10 text-primary"
												: "border-border text-muted-foreground hover:bg-muted",
										)}
									>
										{value}
									</button>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Include checks
							</div>
							<div className="space-y-2">
								{AUDIT_CHECKS.map((check) => (
									<button
										key={check}
										type="button"
										onClick={() => toggleCheck(check)}
										className="flex w-full items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40"
									>
										<Checkbox
											checked={selectedChecks.includes(check)}
											onCheckedChange={() => toggleCheck(check)}
										/>
										<span className="font-mono">{check}</span>
									</button>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Exit code behavior
							</div>
							<div className="flex flex-wrap gap-1">
								{(
									[
										{
											value: "fail-on-findings",
											label: "fail on findings",
										},
										{
											value: "always-succeed",
											label: "always succeed",
										},
									] as const
								).map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() => setExitCodeBehavior(option.value)}
										className={cn(
											"rounded-md border px-2.5 py-1 font-medium text-[11px] transition-colors",
											exitCodeBehavior === option.value
												? "border-primary bg-primary/10 text-primary"
												: "border-border text-muted-foreground hover:bg-muted",
										)}
									>
										{option.label}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				<div className="space-y-4">
					<PreviewPanel
						title="Command preview"
						action={
							<Button
								size="sm"
								variant="outline"
								onClick={() => handleCopy("command", command)}
							>
								{copied === "command" ? "Copied" : "Copy Command"}
							</Button>
						}
					>
						<pre className="overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-[12px] text-slate-100 leading-relaxed">
							{command}
						</pre>
					</PreviewPanel>

					<PreviewPanel
						title="GitHub Actions"
						action={
							<Button
								size="sm"
								variant="outline"
								onClick={() => handleCopy("yaml", yamlSnippet)}
							>
								{copied === "yaml" ? "Copied" : "Copy YAML"}
							</Button>
						}
					>
						<pre className="overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-[12px] text-slate-100 leading-relaxed">
							{yamlSnippet}
						</pre>
					</PreviewPanel>

					<PreviewPanel
						title="Output preview"
						action={
							<Badge variant="outline">
								{storedFindings ? "using last audit results" : "example output"}
							</Badge>
						}
					>
						<OutputPreview findings={findings} format={format} />
					</PreviewPanel>
				</div>
			</div>
		</div>
	);
}

function PreviewPanel({
	title,
	action,
	children,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="rounded-lg border border-border/70 bg-card p-4">
			<div className="mb-3 flex items-center justify-between gap-2">
				<h2 className="font-medium text-sm">{title}</h2>
				{action}
			</div>
			{children}
		</div>
	);
}

function OutputPreview({
	findings,
	format,
}: {
	findings: AuditFinding[];
	format: AuditFormat;
}) {
	if (format === "json") {
		return (
			<pre className="overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-[12px] text-slate-100 leading-relaxed">
				{JSON.stringify(findings, null, 2)}
			</pre>
		);
	}

	if (format === "github") {
		return (
			<pre className="overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-[12px] text-slate-100 leading-relaxed">
				{findings.map(formatGithubAnnotation).join("\n")}
			</pre>
		);
	}

	return (
		<div className="rounded-lg bg-black/40 p-4 font-mono text-[12px] leading-relaxed">
			{findings.map((finding) => (
				<div key={finding.id} className="mb-4 last:mb-0">
					<div
						className={cn(
							"font-semibold",
							finding.severity === "critical" && "text-red-400",
							finding.severity === "warning" && "text-amber-300",
							finding.severity === "info" && "text-sky-300",
						)}
					>
						[{finding.severity.toUpperCase()}] {finding.check} {finding.schema}.
						{finding.table}
					</div>
					<div className="mt-1 text-slate-100">{finding.message}</div>
					<div className="pl-4 text-slate-400">{finding.detail}</div>
				</div>
			))}
		</div>
	);
}
