import { useNavigate } from "react-router-dom";
import { usePersona } from "@/context/persona-context";

export function BottomStatusBar() {
	const navigate = useNavigate();
	const { persona } = usePersona();
	const hasPersona = persona.role && persona.role.length > 0;

	return (
		<footer className="fixed right-0 bottom-0 left-0 z-50 flex h-8 w-full items-center justify-between border-[#222222] border-t bg-[#0d0d0d]">
			<button
				type="button"
				onClick={() => navigate("/simulate")}
				className="flex cursor-pointer items-center px-3"
			>
				{hasPersona ? (
					<span className="font-mono text-[10px] text-accent">
						● persona: {persona.role}
					</span>
				) : (
					<span className="font-mono text-[#555555] text-[10px]">
						○ no persona
					</span>
				)}
			</button>

			<span className="px-3 font-mono text-[#444444] text-[10px]">pg</span>
		</footer>
	);
}
