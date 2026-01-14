import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosRequest } from "../../core";

const ResetPassword = () => {
  const { verificationKey } = useParams(); // comes from the URL
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true); // while validating token
  const [allowed, setAllowed] = useState(false); // is token valid?
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Frontend GET request to check if token is valid
  useEffect(() => {
    const validateLink = async () => {
      try {
        await axiosRequest.get(
          `/auth/password/reset-password/${verificationKey}` // call backend
        );
        setAllowed(true); // token valid → show form
      } catch (err) {
        setError(
          err.response?.data?.message || "Reset link is invalid or expired."
        );
      } finally {
        setChecking(false);
      }
    };

    validateLink();
  }, [verificationKey]);

  if (checking) return <p className="text-center">Validating reset link...</p>;

  if (!allowed)
    return (
      <div className="text-center">
        <p className="text-error-500">{error}</p>
        <button
          onClick={() => navigate("/auth/login")}
          className="mt-4 underline text-primary-500"
        >
          Back to Login
        </button>
      </div>
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || !confirm) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await axiosRequest.post(
        `/auth/password/reset-password/${verificationKey}`,
        { newPassword: password }
      );
      alert("Password reset successful!");
      navigate("/auth/login");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Reset Password</h2>

      {error && <p className="text-error-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <button
          disabled={loading}
          className="w-full bg-primary-500 text-white p-2 rounded"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
