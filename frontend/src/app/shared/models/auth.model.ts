/**
 * Auth Models
 * Data structures for authentication requests and responses
 */

export interface LoginRequest {
  readonly username: string;
  readonly password: string;
}

export interface RegisterRequest {
  readonly username: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

export interface AuthResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user?: UserInfo;
}

export interface UserInfo {
  readonly id: string;
  readonly email: string;
  readonly fullName?: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: string[];
}

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly fullName?: string;
  readonly userId: string;
  readonly roles: string[];
  readonly exp: number;
  readonly iat: number;
}

export interface RefreshTokenResponse {
  readonly accessToken: string;
}
