import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

export function PrivateRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}