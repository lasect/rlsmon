import { useParams } from "react-router-dom";

export function SnapshotDetailPage() {
	const { snapshotId } = useParams();

	return (
		<div className="flex h-full items-center justify-center">
			<h1 className="font-medium text-lg">Snapshot: {snapshotId}</h1>
		</div>
	);
}
