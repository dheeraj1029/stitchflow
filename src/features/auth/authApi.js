let accessToken = null;
let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    throw new ApiError("The service is unavailable. Check your connection and try again.", 0);
  }

  let result = {};
  if (response.status !== 204) {
    try {
      result = await response.json();
    } catch {
      throw new ApiError("The service returned an unreadable response.", response.status);
    }
  }
  if (response.status === 401 && accessToken) {
    setAccessToken(null);
    unauthorizedHandler?.();
  }
  if (!response.ok) {
    throw new ApiError(
      typeof result.error === "string" ? result.error : "The request could not be completed.",
      response.status,
    );
  }
  return result;
}

export function getAccessTokenForTests() {
  return accessToken;
}
