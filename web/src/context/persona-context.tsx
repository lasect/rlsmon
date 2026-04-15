import { createContext, type ReactNode, useContext, useState } from "react";

export interface PersonaState {
	role: string;
	claims: Record<string, unknown>;
	table: string;
	lastRunAt: number | null;
}

interface PersonaContextType {
	persona: PersonaState;
	setPersona: (persona: Partial<PersonaState>) => void;
	clearPersona: () => void;
}

const defaultPersona: PersonaState = {
	role: "",
	claims: {},
	table: "",
	lastRunAt: null,
};

const PersonaContext = createContext<PersonaContextType | null>(null);

export function PersonaProvider({ children }: { children: ReactNode }) {
	const [persona, setPersonaState] = useState<PersonaState>(defaultPersona);

	const setPersona = (updates: Partial<PersonaState>) => {
		setPersonaState((prev) => ({ ...prev, ...updates }));
	};

	const clearPersona = () => {
		setPersonaState(defaultPersona);
	};

	return (
		<PersonaContext.Provider value={{ persona, setPersona, clearPersona }}>
			{children}
		</PersonaContext.Provider>
	);
}

export function usePersona() {
	const context = useContext(PersonaContext);
	if (!context) {
		throw new Error("usePersona must be used within a PersonaProvider");
	}
	return context;
}
