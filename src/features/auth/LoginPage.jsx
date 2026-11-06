import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.js";
import { getRoleHome, validateLoginInput } from "./permissions.js";

export default function LoginPage() {
  const { user, login, isSubmitting } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  if (user) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateLoginInput({ email, password });
    setError(validationError);
    if (validationError) return;
    try {
      const signedInUser = await login({ email: email.trim(), password });
      setPassword("");
      const requestedPath = location.state?.from;
      navigate(
        requestedPath && requestedPath !== "/login"
          ? requestedPath
          : getRoleHome(signedInUser.role),
        { replace: true },
      );
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Please try again.",
      );
    }
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="login-title" className="auth-card">
        <div aria-hidden="true" className="auth-brand-mark">
          <span />
          <span />
          <span />
        </div>
        <p className="auth-eyebrow">STITCHFLOW WORKSPACE</p>
        <h1 id="login-title">Sign in to your account</h1>
        <p className="auth-description">
          Use your assigned demo account to open your production workspace.
        </p>
        {error && <p className="form-alert form-alert--error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email address</span>
            <input
              autoComplete="username"
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button className="button button--primary auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-demo-note">
          Demo accounts and the shared demo password are listed in the backend
          setup guide. Sessions are held in memory and end when this page is
          refreshed.
        </p>
      </section>
    </main>
  );
}
