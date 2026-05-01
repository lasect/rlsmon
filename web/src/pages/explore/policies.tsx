import { Edit2, MessageSquare, Shield, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { trpc } from "@/api/trpc";
import { ApiErrorCard } from "@/components/api-error-card";
import { CodeBlock } from "@/components/code-block";
import { CommandBadge } from "@/components/command-badge";
import { FilterBar } from "@/components/filter-bar";
import { Separator } from "@/components/ui/separator";
import { useAiAvailable } from "@/hooks/use-ai-available";
import { cn } from "@/lib/utils";

type AnnotationStatusFilter =
	| "all"
	| "reviewed"
	| "needs-attention"
	| "approved"
	| "unannotated";

const STATUS_COLORS = {
	reviewed: {
		badge: "bg-green-500/10",
		text: "text-green-500",
		border: "border-green-500/20",
	},
	approved: {
		badge: "bg-blue-500/10",
		text: "text-blue-500",
		border: "border-blue-500/20",
	},
	"needs-attention": {
		badge: "bg-amber-500/10",
		text: "text-amber-500",
		border: "border-amber-500/20",
	},
} as const;

function StatusBadge({
	status,
}: {
	status: "reviewed" | "approved" | "needs-attention";
}) {
	const colors = STATUS_COLORS[status];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium text-[10px]",
				colors.badge,
				colors.text,
				colors.border,
			)}
		>
			{status === "needs-attention" && (
				<span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
			)}
			{status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
		</span>
	);
}

function AnnotationEditForm({
	annotation,
	schema,
	table,
	policy,
	onCancel,
	onSaved,
}: {
	annotation: { note: string; owner: string; status: string } | null;
	schema: string;
	table: string;
	policy: string;
	onCancel: () => void;
	onSaved: () => void;
}) {
	const utils = trpc.useUtils();
	const setMutation = trpc.annotations.set.useMutation({
		onSuccess: () => {
			utils.annotations.list.invalidate();
			onSaved();
		},
	});

	const [note, setNote] = useState(annotation?.note ?? "");
	const [owner, setOwner] = useState(annotation?.owner ?? "");
	const [status, setStatus] = useState<
		"reviewed" | "needs-attention" | "approved"
	>(
		(annotation?.status as "reviewed" | "needs-attention" | "approved") ||
			"needs-attention",
	);

	const handleSave = () => {
		setMutation.mutate({
			schema,
			table,
			policy,
			note: note || undefined,
			owner: owner || undefined,
			status,
		});
	};

	return (
		<div className="space-y-2">
			<div>
				<label className="mb-1 block text-[10px] text-muted-foreground uppercase">
					Status
				</label>
				<select
					value={status}
					onChange={(e) =>
						setStatus(
							e.target.value as "reviewed" | "needs-attention" | "approved",
						)
					}
					className={cn(
						"w-full rounded border border-input bg-background px-2 py-1 text-xs",
					)}
				>
					<option value="reviewed">Reviewed</option>
					<option value="needs-attention">Needs Attention</option>
					<option value="approved">Approved</option>
				</select>
			</div>
			<div>
				<label className="mb-1 block text-[10px] text-muted-foreground uppercase">
					Owner
				</label>
				<input
					type="text"
					value={owner}
					onChange={(e) => setOwner(e.target.value)}
					placeholder="team or person name"
					className={cn(
						"w-full rounded border border-input bg-background px-2 py-1 text-xs",
					)}
				/>
			</div>
			<div>
				<label className="mb-1 block text-[10px] text-muted-foreground uppercase">
					Note
				</label>
				<textarea
					value={note}
					onChange={(e) => setNote(e.target.value)}
					placeholder="Add a note about this policy..."
					rows={3}
					className={cn(
						"w-full rounded border border-input bg-background px-2 py-1 text-xs",
					)}
				/>
			</div>
			<div className="flex gap-2 pt-1">
				<button
					type="button"
					onClick={handleSave}
					disabled={setMutation.isPending}
					className="rounded bg-primary px-3 py-1 font-medium text-primary-foreground text-xs hover:bg-primary/90"
				>
					{setMutation.isPending ? "Saving..." : "Save"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded px-3 py-1 text-muted-foreground text-xs hover:text-foreground"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

function AnnotationDisplay({
	annotation,
	onEdit,
	onDelete,
}: {
	annotation: {
		note: string;
		owner: string;
		status: string;
		updatedAt: string;
	};
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<span className="text-[10px] text-muted-foreground uppercase">
					Status
				</span>
				<StatusBadge
					status={
						annotation.status as "reviewed" | "approved" | "needs-attention"
					}
				/>
			</div>
			{annotation.owner && (
				<div className="text-[11px]">
					<span className="text-muted-foreground">Owner: </span>
					<span className="text-muted-foreground/70">{annotation.owner}</span>
				</div>
			)}
			{annotation.note && (
				<div>
					<div className="mb-1 text-[10px] text-muted-foreground uppercase">
						Note
					</div>
					<div className="rounded bg-card p-2 text-xs">{annotation.note}</div>
				</div>
			)}
			<div className="text-[10px] text-muted-foreground">
				Updated:{" "}
				{new Date(annotation.updatedAt).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				})}
			</div>
			<div className="flex gap-3 pt-1">
				<button
					type="button"
					onClick={onEdit}
					className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
				>
					<Edit2 className="size-3" />
					Edit
				</button>
				<button
					type="button"
					onClick={onDelete}
					className="flex items-center gap-1 text-muted-foreground text-xs hover:text-destructive"
				>
					<Trash2 className="size-3" />
					Delete
				</button>
			</div>
		</div>
	);
}

export function PoliciesPage() {
	const {
		data: policiesData,
		isLoading,
		error,
		refetch,
	} = trpc.policies.list.useQuery();
	const { data: annotationsData } = trpc.annotations.list.useQuery();
	const utils = trpc.useUtils();
	const deleteMutation = trpc.annotations.delete.useMutation({
		onSuccess: () => {
			utils.annotations.list.invalidate();
		},
	});

	const [search, setSearch] = useState("");
	const [selectedName, setSelectedName] = useState<string | null>(null);
	const [annotationFilter, setAnnotationFilter] =
		useState<AnnotationStatusFilter>("all");
	const [isEditingAnnotation, setIsEditingAnnotation] = useState(false);
	const [explainCache, setExplainCache] = useState<Record<string, string>>({});
	const [explainLoading, setExplainLoading] = useState(false);
	const [explainError, setExplainError] = useState<string | null>(null);

	const { available: aiAvailable, openSettings } = useAiAvailable();
	const explainMutation = trpc.ai.explain.useMutation();

	const [searchParams] = useSearchParams();

	useEffect(() => {
		const tableParam = searchParams.get("table");
		const policyParam = searchParams.get("policy");

		if (tableParam) {
			setSearch(tableParam);
		}

		if (policyParam) {
			setSelectedName(policyParam);
			return;
		}

		if (tableParam && policiesData) {
			const match = policiesData.find(
				(policy) => `${policy.schema}.${policy.table}` === tableParam,
			);
			if (match) {
				setSelectedName(match.name);
			}
		}
	}, [policiesData, searchParams]);

	const annotationMap = new Map<
		string,
		{
			key: string;
			schema: string;
			table: string;
			policy: string;
			note: string;
			owner: string;
			status: string;
			updatedAt: string;
		}
	>();
	if (annotationsData) {
		for (const a of annotationsData) {
			annotationMap.set(a.key, a);
		}
	}

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">Loading policies...</div>
			</div>
		);
	}

	if (error) {
		return (
			<ApiErrorCard
				error={error}
				retry={() => refetch()}
				endpoint="/api/policies"
			/>
		);
	}

	if (!policiesData || policiesData.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">No policies found</div>
			</div>
		);
	}

	let filtered = policiesData.filter((p) => {
		if (!search) return true;
		const s = search.toLowerCase();
		return (
			p.name.toLowerCase().includes(s) ||
			p.table.toLowerCase().includes(s) ||
			p.schema.toLowerCase().includes(s) ||
			p.using?.toLowerCase().includes(s) ||
			p.withCheck?.toLowerCase().includes(s)
		);
	});

	if (annotationFilter !== "all") {
		filtered = filtered.filter((p) => {
			const key = `${p.schema}.${p.table}.${p.name}`;
			const annotation = annotationMap.get(key);
			if (annotationFilter === "unannotated") {
				return !annotation;
			}
			return annotation?.status === annotationFilter;
		});
	}

	const groups: { key: string; label: string; items: typeof policiesData }[] =
		[];
	const tableMap = new Map<string, typeof policiesData>();
	for (const p of filtered) {
		const key = `${p.schema}.${p.table}`;
		if (!tableMap.has(key)) tableMap.set(key, []);
		tableMap.get(key)?.push(p);
	}
	for (const [key, items] of tableMap) {
		groups.push({ key, label: key, items });
	}

	const selected = policiesData.find((p) => p.name === selectedName) ?? null;
	const selectedAnnotation = selected
		? (annotationMap.get(
				`${selected.schema}.${selected.table}.${selected.name}`,
			) ?? null)
		: null;

	const annotatedCount = annotationsData?.length ?? 0;
	const needsAttentionCount =
		annotationsData?.filter((a) => a.status === "needs-attention").length ?? 0;

	const handleDeleteAnnotation = (
		schema: string,
		table: string,
		policy: string,
	) => {
		deleteMutation.mutate({ schema, table, policy });
	};

	const handleExplain = async () => {
		if (!selected) return;
		const cacheKey = `${selected.name}:${selected.schema}:${selected.table}`;
		setExplainLoading(true);
		setExplainError(null);

		try {
			const result = await explainMutation.mutateAsync({
				policyName: selected.name,
				schema: selected.schema,
				table: selected.table,
				cmd: selected.command,
				permissive: selected.permissive,
				roles: selected.roles,
				using: selected.using,
				withCheck: selected.withCheck,
			});

			if ("error" in result && result.error) {
				setExplainError(
					(result as { message?: string }).message ?? "AI explanation failed",
				);
			} else if ("explanation" in result) {
				setExplainCache((prev) => ({
					...prev,
					[cacheKey]: result.explanation,
				}));
			}
		} catch (e) {
			setExplainError(e instanceof Error ? e.message : "Unknown error");
		} finally {
			setExplainLoading(false);
		}
	};

	return (
		<div className="flex h-full">
			<div className="flex w-80 flex-shrink-0 flex-col border-border border-r">
				<div className="flex-shrink-0 px-3 pt-3 pb-2">
					<div className="mb-2">
						<h1 className="font-semibold text-sm">Policies</h1>
						<p className="text-[11px] text-muted-foreground">
							{filtered.length} polic{filtered.length !== 1 ? "ies" : "y"}
							{annotatedCount > 0 && (
								<span>
									{" · "}
									{annotatedCount} annotated
									{needsAttentionCount > 0 && (
										<span className="text-amber-500">
											{" · "}
											{needsAttentionCount} need
											{needsAttentionCount !== 1 && "s"} attention
										</span>
									)}
								</span>
							)}
						</p>
					</div>
					<FilterBar
						search={search}
						onSearchChange={setSearch}
						placeholder="Search policies..."
					/>
					<div className="mt-2 flex flex-wrap gap-1">
						{(
							[
								{ key: "all", label: "All" },
								{ key: "reviewed", label: "Reviewed" },
								{ key: "needs-attention", label: "Needs" },
								{ key: "approved", label: "Approved" },
								{ key: "unannotated", label: "None" },
							] as const
						).map((opt) => (
							<button
								key={opt.key}
								type="button"
								onClick={() => setAnnotationFilter(opt.key)}
								className={cn(
									"rounded border border-white/10 px-1.5 py-0.5 text-[10px] transition-colors",
									annotationFilter === opt.key
										? "border-primary/30 bg-primary/20 text-primary"
										: "text-muted-foreground hover:border-white/30",
								)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>
				<div className="flex-1 overflow-y-auto px-2 pb-2">
					{groups.map((group) => (
						<div key={group.key} className="mb-2">
							<div className="px-2 py-1 font-medium text-[10px] text-muted-foreground/60 uppercase tracking-wider">
								{group.label}
							</div>
							{group.items.map((policy) => {
								const key = `${policy.schema}.${policy.table}.${policy.name}`;
								const annotation = annotationMap.get(key);
								return (
									<button
										key={policy.name}
										type="button"
										onClick={() => setSelectedName(policy.name)}
										className={cn(
											"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
											selectedName === policy.name
												? "bg-muted"
												: "hover:bg-muted/50",
										)}
									>
										<div className="flex min-w-0 flex-1 flex-col">
											<code className="truncate font-medium font-mono text-[11px]">
												{policy.name}
											</code>
											<span className="truncate text-[10px] text-muted-foreground">
												{policy.schema}.{policy.table}
											</span>
										</div>
										<div className="flex shrink-0 items-center gap-1.5">
											{annotation && (
												<>
													{annotation.note && (
														<MessageSquare className="size-3 text-muted-foreground/50" />
													)}
													<StatusBadge
														status={
															annotation.status as
																| "reviewed"
																| "approved"
																| "needs-attention"
														}
													/>
												</>
											)}
											<CommandBadge command={policy.command} />
										</div>
									</button>
								);
							})}
						</div>
					))}
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-auto">
				{selected ? (
					<div className="p-4">
						<div className="mb-4">
							<div className="mb-1 flex items-center gap-2">
								<Shield className="size-4 text-muted-foreground" />
								<code className="font-mono font-semibold text-sm">
									{selected.name}
								</code>
								<CommandBadge command={selected.command} />
							</div>
							<div className="text-muted-foreground text-xs">
								<code className="font-mono">
									{selected.schema}.{selected.table}
								</code>
							</div>
						</div>

						<Separator className="mb-4" />

						<div className="space-y-4">
							<div className="space-y-1.5">
								<div className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									<Users className="size-3" />
									Roles
								</div>
								<div className="flex flex-wrap gap-1.5">
									{selected.roles.map((role) => (
										<span
											key={role}
											className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]"
										>
											{role}
										</span>
									))}
								</div>
							</div>

							{selected.using && (
								<div className="space-y-1.5">
									<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Using
									</div>
									<CodeBlock code={selected.using} />
								</div>
							)}

							{selected.withCheck && (
								<div className="space-y-1.5">
									<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										With Check
									</div>
									<CodeBlock code={selected.withCheck} />
								</div>
							)}

							{selected.permissive && (
								<div className="space-y-1.5">
									<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Permissive
									</div>
									<span className="rounded bg-muted px-2 py-0.5 text-[11px]">
										{selected.permissive}
									</span>
								</div>
							)}

							<Separator className="my-4" />

							<div className="space-y-1.5">
								<div className="font-mono text-[#666666] text-[10px] uppercase tracking-widest">
									AI Explanation
								</div>
								{explainLoading ? (
									<div className="animate-pulse font-mono text-[11px] text-accent opacity-50">
										✦ Explaining...
									</div>
								) : explainError &&
									!explainCache[
										`${selected.name}:${selected.schema}:${selected.table}`
									] ? (
									<div className="space-y-1">
										<div className="text-destructive text-xs">
											{explainError}
										</div>
										<button
											type="button"
											onClick={handleExplain}
											className="font-mono text-[11px] text-accent hover:underline"
										>
											↻ Retry
										</button>
									</div>
								) : explainCache[
										`${selected.name}:${selected.schema}:${selected.table}`
									] ? (
									<div className="space-y-1">
										<div className="font-sans text-[#cccccc] text-xs">
											{
												explainCache[
													`${selected.name}:${selected.schema}:${selected.table}`
												]
											}
										</div>
										<button
											type="button"
											onClick={handleExplain}
											className="font-mono text-[11px] text-accent hover:underline"
										>
											↻ Re-explain
										</button>
									</div>
								) : !aiAvailable ? (
									<div className="space-y-1">
										<div className="text-muted-foreground text-xs">
											Add an AI provider in Settings to use AI features
										</div>
										<button
											type="button"
											onClick={openSettings}
											className="font-mono text-[11px] text-accent hover:underline"
										>
											Open Settings →
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={handleExplain}
										className="rounded border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:border-accent hover:text-accent"
									>
										✦ Explain this policy
									</button>
								)}
							</div>

							<Separator className="my-4" />

							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Annotation
									</div>
									{(isEditingAnnotation || !selectedAnnotation) && (
										<button
											type="button"
											onClick={() => setIsEditingAnnotation(true)}
											className="text-muted-foreground text-xs hover:text-foreground"
										>
											<Edit2 className="size-3" />
										</button>
									)}
								</div>

								{!isEditingAnnotation && selectedAnnotation && (
									<AnnotationDisplay
										annotation={selectedAnnotation}
										onEdit={() => setIsEditingAnnotation(true)}
										onDelete={() =>
											handleDeleteAnnotation(
												selected!.schema,
												selected!.table,
												selected!.name,
											)
										}
									/>
								)}

								{isEditingAnnotation && (
									<AnnotationEditForm
										annotation={
											selectedAnnotation
												? {
														note: selectedAnnotation.note,
														owner: selectedAnnotation.owner,
														status: selectedAnnotation.status,
													}
												: null
										}
										schema={selected.schema}
										table={selected.table}
										policy={selected.name}
										onCancel={() => setIsEditingAnnotation(false)}
										onSaved={() => setIsEditingAnnotation(false)}
									/>
								)}

								{!isEditingAnnotation && !selectedAnnotation && (
									<button
										type="button"
										onClick={() => setIsEditingAnnotation(true)}
										className={cn(
											"w-full cursor-pointer rounded border border-white/20 border-dashed p-3 text-muted-foreground text-xs hover:border-white/40",
										)}
									>
										+ Add annotation
									</button>
								)}
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center">
						<div className="text-center">
							<Shield className="mx-auto mb-2 size-8 text-muted-foreground/30" />
							<div className="text-muted-foreground text-xs">
								Select a policy to inspect
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
