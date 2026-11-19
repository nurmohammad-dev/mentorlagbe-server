import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const JWKS = createRemoteJWKSet(new URL(`${AUTH_URL}/api/auth/jwks`));

export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or expired token" });
  }
}