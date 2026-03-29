import type { Context } from "hono";

export type ContextOptions = {
	context: Context;
};

export const createContext = ({ context }: ContextOptions) => {
	return {
		context,
	};
};

export type TRPCContext = Awaited<ReturnType<typeof createContext>>;
