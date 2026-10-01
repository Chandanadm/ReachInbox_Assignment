import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState("Completing your sign in...");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("Authentication failed. No token was received.");
      return;
    }

    localStorage.setItem("reachinbox_token", token);

    setStatus("Authentication successful. Redirecting...");
  }, [token]);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2>{status}</h2>
        <p>Please try signing in again.</p>
      </div>
    </main>
  );
};

export default AuthCallbackPage;