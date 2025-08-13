import * as zod from "zod";

export interface User {
	login: string
	first_name: string
	last_name: string
	email: string
}

const User = zod.object({
	name: zod.string(),
	first_name: zod.string(),
	last_name: zod.string(),
	email: zod.string()
});
