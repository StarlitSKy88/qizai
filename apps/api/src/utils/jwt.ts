import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
  sub: string;       // user id
  email: string;
  exp?: number;
}

const ALG = 'HS256';
const EXPIRES = '7d';

export async function signToken(payload: { sub: string; email: string }, secret: string): Promise<string> {
  const jwt = new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(EXPIRES);
  return jwt.sign(new TextEncoder().encode(secret));
}

export async function verifyToken(token: string, secret: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    exp: payload.exp,
  };
}
