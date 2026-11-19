import { getCollections } from "../config/db.js";

function createRoleGuard(allowedRoles) {
  return async (req, res, next) => {
    try {
      const email = req.user?.email;

      if (!email) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User email missing in token" });
      }

      const { usersCollection } = await getCollections();
      const dbUser = await usersCollection.findOne({ email });

      // Prefer latest role from DB; fallback to JWT payload role
      const currentRole = dbUser?.role || req.user?.role;

      if (!currentRole || !allowedRoles.includes(currentRole)) {
        return res.status(403).json({
          message: `Forbidden: Requires ${allowedRoles.join(" or ")} access`,
        });
      }

      req.user.role = currentRole;
      next();
    } catch (err) {
      return res.status(500).json({ message: "Failed to verify user role" });
    }
  };
}

export const verifyStudent = createRoleGuard(["student"]);
export const verifyTutor = createRoleGuard(["tutor"]);
export const verifyAdmin = createRoleGuard(["admin"]);