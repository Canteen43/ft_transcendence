import jwt from 'jsonwebtoken';
import {
	ERROR_INVALID_CREDENTIALS,
	ERROR_INVALID_TOKEN,
	ERROR_TOKEN_EXPIRED,
	ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST,
	TOKEN_VALIDITY_PERIOD,
} from '../../shared/constants.js';
import {
	AuthenticationError,
	AuthenticationFailedError,
} from '../../shared/exceptions.js';
import {
	AuthRequest,
	AuthResponse,
	AuthResponseSchema,
	User,
} from '../../shared/schemas/user.js';
import UserRepository from '../repositories/user_repository.js';
import { AuthPayload } from '../types/interfaces.js';

export default class UserService {
	static authenticate(authRequest: AuthRequest): AuthResponse {
		if (!process.env.JWT_SECRET)
			throw new AuthenticationError(
				ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST
			);
		const user: User | null = UserRepository.authenticateUser(authRequest);
		if (!user)
			throw new AuthenticationFailedError(ERROR_INVALID_CREDENTIALS);
		return AuthResponseSchema.parse({
			id: user.id,
			token: jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
				expiresIn: TOKEN_VALIDITY_PERIOD,
			}),
		});
	}

	static verifyToken(token: string): AuthPayload {
		if (!process.env.JWT_SECRET)
			throw new AuthenticationError(
				ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST
			);
		try {
			const decode = jwt.verify(token, process.env.JWT_SECRET);
			if (!(decode && typeof decode === 'object' && 'userId' in decode))
				throw new AuthenticationFailedError(ERROR_INVALID_TOKEN);
			return decode as AuthPayload;
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError)
				throw new AuthenticationFailedError(ERROR_TOKEN_EXPIRED);
			else if (error instanceof jwt.JsonWebTokenError)
				throw new AuthenticationFailedError(ERROR_INVALID_TOKEN);
			else if (error instanceof AuthenticationFailedError)
				throw new AuthenticationFailedError(ERROR_INVALID_TOKEN);
			throw new AuthenticationError(
				ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST
			);
		}
	}
}
