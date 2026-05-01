import { useState } from "react";

interface JsonCellProps {
	value: unknown;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

function isValidJson(value: string): boolean {
	try {
		const parsed = JSON.parse(value);
		return typeof parsed === "object" && parsed !== null;
	} catch {
		return false;
	}
}

function formatJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function isUuidColumn(values: unknown[]): boolean {
	if (values.length === 0) return false;
	return values.every((v) => {
		if (typeof v !== "string") return false;
		return UUID_REGEX.test(v);
	});
}

export function JsonCell({ value }: JsonCellProps) {
	const [expanded, setExpanded] = useState(false);

	if (value === null) {
		return <span className="text-muted-foreground">NULL</span>;
	}

	if (typeof value === "object") {
		return expanded ? (
			<pre className="mt-1 whitespace-pre-wrap break-all rounded bg-card p-2 font-mono text-[10px]">
				{formatJson(value)}
			</pre>
		) : (
			<button
				type="button"
				onClick={() => setExpanded(true)}
				className="cursor-pointer text-muted-foreground hover:text-foreground"
			>
				{"{...}"}
			</button>
		);
	}

	const strValue = String(value);
	if (isValidJson(strValue)) {
		return expanded ? (
			<pre className="mt-1 whitespace-pre-wrap break-all rounded bg-card p-2 font-mono text-[10px]">
				{formatJson(JSON.parse(strValue))}
			</pre>
		) : (
			<button
				type="button"
				onClick={() => setExpanded(true)}
				className="cursor-pointer text-muted-foreground hover:text-foreground"
			>
				{"{...}"}
			</button>
		);
	}

	return String(value);
}

interface UuidCellProps {
	value: unknown;
}

export function UuidCell({ value }: UuidCellProps) {
	if (value === null) {
		return <span className="text-muted-foreground">NULL</span>;
	}

	const strValue = String(value);
	if (!UUID_REGEX.test(strValue)) {
		return String(value);
	}

	const truncated = strValue.slice(0, 8) + "...";

	return (
		<span className="cursor-help" title={strValue}>
			{truncated}
		</span>
	);
}

export function CellRenderer({
	value,
	allColumnValues,
}: {
	value: unknown;
	allColumnValues: unknown[];
}) {
	if (value === null) {
		return <span className="text-muted-foreground">NULL</span>;
	}

	if (isUuidColumn(allColumnValues)) {
		return <UuidCell value={value} />;
	}

	if (typeof value === "object" || isValidJson(String(value))) {
		return <JsonCell value={value} />;
	}

	return String(value);
}
