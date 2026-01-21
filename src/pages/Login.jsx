import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

import { auth, db } from "../firebase"; 
import styled from "styled-components";

export default function Login() {
  const [nipp, setNipp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      
      const q = query(
        collection(db, "users"),
        where("nipp", "==", nipp)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("NIPP tidak terdaftar");
      }

      const userData = snap.docs[0].data();
      const email = userData.email;

      if (!email) {
        throw new Error("Email tidak ditemukan untuk NIPP ini");
      }

      // 🔐 2. Login ke Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);

      // ✅ 3. Redirect ke dashboard
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <Card>
        <Title>Login</Title>

        <form onSubmit={handleLogin}>
          <InputGroup>
            <label>NIPP</label>
            <input
              type="text"
              value={nipp}
              onChange={(e) => setNipp(e.target.value)}
              required
            />
          </InputGroup>

          <InputGroup>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </InputGroup>

          {error && <ErrorText>{error}</ErrorText>}

          <Button disabled={loading}>
            {loading ? "Memproses..." : "Login"}
          </Button>
        </form>
      </Card>
    </Wrapper>
  );
}

// ================= STYLES =================

const Wrapper = styled.div`
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Card = styled.div`
  width: 360px;
  background: #ffffff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
`;

const Title = styled.h1`
  text-align: center;
  font-size: 22px;
  color: #002b5b;
  margin-bottom: 4px;
`;

const InputGroup = styled.div`
  margin-bottom: 16px;

  label {
    font-size: 13px;
    color: #333;
  }

  input {
    width: 100%;
    padding: 10px;
    margin-top: 6px;
    border-radius: 6px;
    border: 1px solid #ccc;
    font-size: 14px;
  }
`;

const Button = styled.button`
  width: 100%;
  margin-top: 10px;
  background: #002b5b;
  color: #fff;
  border: none;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.div`
  margin-top: 10px;
  color: #d62828;
  font-size: 13px;
  text-align: center;
`;