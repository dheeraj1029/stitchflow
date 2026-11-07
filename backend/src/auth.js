import jwt from "jsonwebtoken";

export function toSafeUser(user, repository) {
  const organization = (repository.organizations || []).find(
    (item) => item.id === user.buyerOrganizationId,
  );
  const unit = (repository.productionUnits || []).find(
    (item) => item.id === user.productionUnitId,
  );
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    buyerOrganizationId: user.buyerOrganizationId,
    buyerOrganizationName: user.buyerOrganizationName || organization?.name || null,
    productionUnitId: user.productionUnitId,
    productionUnitName: user.productionUnitName || unit?.name || null,
  };
}

export function createAccessToken(user, secret, expiresIn = "1h") {
  return jwt.sign({ sub: user.id }, secret, {
    algorithm: "HS256",
    expiresIn,
  });
}

export function createAuthenticationMiddleware(repository, secret) {
  return function authenticate(request, response, next) {
    const authorization = request.get("authorization") || "";
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) {
      return response.status(401).json({ error: "Authentication is required." });
    }

    let payload;
    try {
      payload = jwt.verify(match[1], secret, {
        algorithms: ["HS256"],
      });
    } catch {
      return response.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
    }
    if (
      !payload ||
      typeof payload.sub !== "string" ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return response.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
    }
    return Promise.resolve(repository.findUserById(payload.sub)).then((user) => {
      if (!user || !user.isActive) {
        return response.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
      }
      request.authUser = user;
      return next();
    }).catch(next);
  };
}

export function authorizeRoles(...roles) {
  return function authorize(request, response, next) {
    if (!roles.includes(request.authUser?.role)) {
      return response.status(403).json({ error: "You do not have permission to perform this action." });
    }
    return next();
  };
}
