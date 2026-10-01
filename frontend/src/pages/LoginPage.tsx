import { Mail } from "lucide-react";

const API_URL = "http://localhost:5000";

const LoginPage = () => {
  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand">
          <div className="brand-icon">
            <Mail size={24} />
          </div>

          <span>ReachInbox</span>
        </div>

        <div className="login-content">
          <p className="eyebrow">EMAIL SCHEDULER</p>

          <h1>Welcome back</h1>

          <p className="description">
            Schedule, manage, and track your email campaigns from one
            powerful workspace.
          </p>

          <button
            type="button"
            className="google-button"
            onClick={handleGoogleLogin}
          >
            <span className="google-logo">G</span>
            <span>Continue with Google</span>
          </button>

          <p className="security-text">
            Your account is securely authenticated with Google.
          </p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;