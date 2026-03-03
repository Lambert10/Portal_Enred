import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const authHeader = req.headers?.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "No autorizado" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("auth middleware error: JWT_SECRET no configurado");
    return res.status(500).json({ error: "Error de servidor" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "No autorizado" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Permisos insuficientes" });
  }

  return next();
}
