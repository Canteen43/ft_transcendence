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
import { LockService, LockType } from './lock_service.js';

export default class UserService {
	static async authenticate(authRequest: AuthRequest): Promise<AuthResponse> {
		return await LockService.withLock(LockType.Auth, () =>
			this.authenticateWithLock(authRequest)
		);
	}

	private static async authenticateWithLock(
		authRequest: AuthRequest
	): Promise<AuthResponse> {
		if (!process.env.JWT_SECRET)
			throw new AuthenticationError(
				ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST
			);
		const user: User | null =
			await UserRepository.authenticateUser(authRequest);
		if (!user)
			throw new AuthenticationFailedError(ERROR_INVALID_CREDENTIALS);

		const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
			expiresIn: TOKEN_VALIDITY_PERIOD,
		});
		return AuthResponseSchema.parse({
			login: user.login,
			user_id: user.id,
			token: token,
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
