import jwt from "jsonwebtoken";
import { User, Activity } from "./models.js";

export async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Please sign in." });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("-password -emailOtpHash -resetOtpHash");
    if (!user) return res.status(401).json({ message: "Account not found." });
    req.user = user;
    next();
  } catch { return res.status(401).json({ message: "Session expired. Please sign in again." }); }
}
export const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: "You don't have permission for this action." });

export async function audit(req, action, entity, details = "") {
  try {
    await Activity.create({ actor: req.user?._id, actorName: req.user?.name || "System", action, entity, details, ip: req.ip });
  } catch (e) { console.error("Audit log error:", e.message); }
}
