import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";

export type AnnotationStatus = "reviewed" | "needs-attention" | "approved";

export type Annotation = {
	note: string;
	owner: string;
	status: AnnotationStatus;
	updatedAt: string;
};

export type AnnotationsFile = Record<string, Annotation>;

function getAnnotationsPath(): string {
	return path.join(process.cwd(), ".rlsmon", "annotations.yaml");
}

function ensureAnnotationsDir(): void {
	fs.mkdirSync(path.join(process.cwd(), ".rlsmon"), { recursive: true });
}

export function readAnnotations(): AnnotationsFile {
	const filePath = getAnnotationsPath();
	if (!fs.existsSync(filePath)) {
		return {};
	}
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const parsed = YAML.parse(content);
		return parsed || {};
	} catch (e) {
		console.warn("Failed to parse annotations.yaml:", e);
		return {};
	}
}

export function writeAnnotations(annotations: AnnotationsFile): void {
	ensureAnnotationsDir();
	const filePath = getAnnotationsPath();

	const header = `# RLSMon Policy Annotations
# Edit directly or use the RLSMon UI
#
`;

	const yamlContent = YAML.stringify(annotations, { sortKeys: true });
	fs.writeFileSync(filePath, header + yamlContent);
}

export function getAnnotation(
	schema: string,
	table: string,
	policy: string,
): Annotation | null {
	const key = `${schema}.${table}.${policy}`;
	const annotations = readAnnotations();
	return annotations[key] || null;
}

export function setAnnotation(
	schema: string,
	table: string,
	policy: string,
	annotation: Partial<Annotation>,
): Annotation {
	const key = `${schema}.${table}.${policy}`;
	const annotations = readAnnotations();
	const existing = annotations[key] || {
		note: "",
		owner: "",
		status: "needs-attention" as AnnotationStatus,
		updatedAt: "",
	};

	const updated: Annotation = {
		...existing,
		...annotation,
		updatedAt: new Date().toISOString(),
	};

	annotations[key] = updated;
	writeAnnotations(annotations);
	return updated;
}

export function deleteAnnotation(
	schema: string,
	table: string,
	policy: string,
): void {
	const key = `${schema}.${table}.${policy}`;
	const annotations = readAnnotations();
	delete annotations[key];
	writeAnnotations(annotations);
}
