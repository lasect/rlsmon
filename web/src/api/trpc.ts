import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../src/api/routers/index";

export const trpc = createTRPCReact<AppRouter>();
