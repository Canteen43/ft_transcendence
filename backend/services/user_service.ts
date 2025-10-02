import Cryptr from 'cryptr';
import jwt from 'jsonwebtoken';
import { TOTP } from 'otpauth';
import QRCode from 'qrcode';
import {
	ERROR_2FA_NOT_CONFIGURED,
	ERROR_INVALID_CREDENTIALS,
	ERROR_INVALID_TOKEN,
	ERROR_NO_2FA_IN_PROGRESS,
	ERROR_TOKEN_EXPIRED,
	ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST,
	ERROR_USER_NOT_FOUND,
	TOKEN_VALIDITY_2FA,
	TOKEN_VALIDITY_AUTH,
	TWO_FACTOR_ALGORITHM,
	TWO_FACTOR_ISSUER,
} from '../../shared/constants.js';
import { Token } from '../../shared/enums.js';
import {
	AuthenticationError,
	AuthenticationFailedError,
	TwoFactorAlreadyEnabledError,
	TwoFactorVerificationError,
	UserNotFoundError,
} from '../../shared/exceptions.js';
import {
	AuthRequest,
	AuthResponse,
	AuthResponseSchema,
	User,
} from '../../shared/schemas/user.js';
import { UUID } from '../../shared/types.js';
import UserRepository from '../repositories/user_repository.js';
import { AuthPayload, TwoFactorSecret } from '../types/interfaces.js';
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

		const type = user.two_factor_enabled ? Token.TwoFactor : Token.Auth;

		const validity = user.two_factor_enabled
			? TOKEN_VALIDITY_2FA
			: TOKEN_VALIDITY_AUTH;

		const token = jwt.sign(
			{ userId: user.id, type: type },
			process.env.JWT_SECRET,
			{
				expiresIn: validity,
			}
		);

		return AuthResponseSchema.parse({
			login: user.login,
			user_id: user.id,
			token: token,
			two_factor_enabled: user.two_factor_enabled,
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

	static async getQRForEnableTwoFactor(userId: UUID): Promise<string> {
		const user = UserRepository.getUser(userId);
		if (!user) throw new UserNotFoundError(userId);
		const data = await this.createTwoFactorSecret(user.login);
		if (user.two_factor_enabled)
			throw new TwoFactorAlreadyEnabledError(userId);
		if (!process.env.TWO_FA_KEY)
			throw new AuthenticationError(
				ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST
			);
		const cryptr = new Cryptr(process.env.TWO_FA_KEY);
		const encrypted_secret = cryptr.encrypt(data.secret);
		UserRepository.setTwoFactor(userId, {
			two_factor_temp_secret: encrypted_secret,
		});
		return data.qrCodeDataUrl;
	}

	static verifyEnableTwoFactor(userId: UUID, two_fa_token: string) {
		const user = UserRepository.getUser(userId);
		if (!user) throw new TwoFactorVerificationError(ERROR_USER_NOT_FOUND);

		const secret = UserRepository.getTwoFactorSecret(userId, true);
		if (!secret)
			throw new TwoFactorVerificationError(ERROR_2FA_NOT_CONFIGURED);

		if (!this.validateTwoFactorSecret(two_fa_token, secret))
			throw new TwoFactorVerificationError(ERROR_INVALID_TOKEN);

		UserRepository.setTwoFactor(userId, {
			two_factor_enabled: true,
			two_factor_temp_secret: null,
			two_factor_secret: secret,
		});
	}

	static validateTwoFactor(userId: UUID, two_fa_token: string) {
		const user = UserRepository.getUser(userId);
		if (!user) throw new AuthenticationError(ERROR_NO_2FA_IN_PROGRESS);

		const secret = UserRepository.getTwoFactorSecret(userId, false);
		if (!secret) throw new AuthenticationError(ERROR_NO_2FA_IN_PROGRESS);

		if (!this.validateTwoFactorSecret(two_fa_token, secret))
			throw new AuthenticationError(ERROR_INVALID_TOKEN);

		if (!process.env.JWT_SECRET)
			throw new AuthenticationError(
				ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST
			);

		const token = jwt.sign(
			{ userId: user.id, type: Token.Auth },
			process.env.JWT_SECRET,
			{
				expiresIn: TOKEN_VALIDITY_AUTH,
			}
		);

		return AuthResponseSchema.parse({
			login: user.login,
			user_id: user.id,
			token: token,
			two_factor_enabled: user.two_factor_enabled,
		});
	}

	private static validateTwoFactorSecret(
		token: string,
		encrypted_secret: string
	): boolean {
		if (!process.env.TWO_FA_KEY)
			throw new AuthenticationError(
				ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST
			);
		const cryptr = new Cryptr(process.env.TWO_FA_KEY);
		const secret = cryptr.decrypt(encrypted_secret);
		const totp = new TOTP({ secret });
		const delta = totp.validate({ token, window: 1 });
		return delta !== null;
	}

	private static async createTwoFactorSecret(
		login: string
	): Promise<TwoFactorSecret> {
		const totp = new TOTP({
			issuer: TWO_FACTOR_ISSUER,
			label: login,
			algorithm: TWO_FACTOR_ALGORITHM,
			digits: 6,
			period: 30,
		});

		const secret = totp.secret.base32;
		const otpauthUrl = totp.toString();
		const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
			errorCorrectionLevel: 'M',
		});
		return { secret, otpauthUrl, qrCodeDataUrl };
	}
}
