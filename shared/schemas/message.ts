import z from "zod";

export const MessageSchema = z.object({
	t: z.string(),
	d: z.string().optional(),
	l: z.array(z.number()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;
