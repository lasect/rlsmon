import {
	createBrowserRouter,
	Navigate,
	RouterProvider,
} from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AiPage } from "@/pages/ai";
import { AuditPage } from "@/pages/audit";
import { AuditCiPage } from "@/pages/audit/ci";
import { MatrixPage } from "@/pages/explore/matrix";
import { PoliciesPage } from "@/pages/explore/policies";
import { RolesPage } from "@/pages/explore/roles";
import { RowAccessPage } from "@/pages/explore/row-access";
import { HistoryPage } from "@/pages/history";
import { HistoryDiffPage } from "@/pages/history/diff";
import { SnapshotDetailPage } from "@/pages/history/snapshot-detail";
import { SettingsPage } from "@/pages/settings";
import { SimulatePage } from "@/pages/simulate";

const router = createBrowserRouter([
	{
		path: "/",
		element: <AppShell />,
		children: [
			{ index: true, element: <Navigate to="/explore/matrix" replace /> },
			{ path: "explore/matrix", element: <MatrixPage /> },
			{ path: "explore/policies", element: <PoliciesPage /> },
			{ path: "explore/roles", element: <RolesPage /> },
			{ path: "explore/row-access", element: <RowAccessPage /> },
			{ path: "simulate", element: <SimulatePage /> },
			{ path: "audit", element: <AuditPage /> },
			{ path: "audit/ci", element: <AuditCiPage /> },
			{ path: "ai", element: <AiPage /> },
			{ path: "history", element: <HistoryPage /> },
			{ path: "history/:snapshotId", element: <SnapshotDetailPage /> },
			{ path: "history/diff", element: <HistoryDiffPage /> },
			{ path: "settings", element: <SettingsPage /> },
		],
	},
]);

export function App() {
	return <RouterProvider router={router} />;
}

export default App;
