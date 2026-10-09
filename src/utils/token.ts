import { Response, CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../models/user.model';

export interface TokenPayload {
  id: string;
  role: UserRole;
  email: string;
}

export interface RefreshTokenPayload {
  id: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET || 'supersecret_jwt_key_ivtex_crm_2026_change_in_production';
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';

  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'supersecret_refresh_jwt_key_ivtex_crm_2026_change_in_production';
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET || 'supersecret_jwt_key_ivtex_crm_2026_change_in_production';
  return jwt.verify(token, secret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'supersecret_refresh_jwt_key_ivtex_crm_2026_change_in_production';
  return jwt.verify(token, secret) as RefreshTokenPayload;
};

// Aliases for backwards compatibility
export const generateToken = generateAccessToken;
export const verifyToken = verifyAccessToken;

// Cookie helper options
export const getCookieOptions = (maxAgeMs: number): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: maxAgeMs,
    path: '/'
  };
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  // 15 minutes for access token
  res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
  // 7 days for refresh token
  res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
};

export const clearAuthCookies = (res: Response): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  const clearOptions: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/'
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
};
