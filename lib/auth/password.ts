import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

/**
 * Hashes a plaintext password using bcrypt with 10 salt rounds.
 * Never logs or exposes the plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string.")
  }
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 * Returns false safely if either value is invalid.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!password || !hash || typeof password !== "string" || typeof hash !== "string") {
    return false
  }
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}
