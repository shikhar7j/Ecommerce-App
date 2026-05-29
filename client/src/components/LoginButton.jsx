import { useAuth0 } from "@auth0/auth0-react";
import React from "react";
import styles from "./LoginButton.module.css";

const LoginButton = () => {
  const { loginWithRedirect, isAuthenticated, logout, user, isLoading, error } =
    useAuth0();

  return (
    <>
      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()}>Log In</button>
      ) : (
        <div>
          <p>Welcome, {user?.name}</p>
          <button onClick={() => logout({ returnTo: window.location.origin })}>
            Log Out
          </button>
        </div>
      )}
    </>
  );
};

export default LoginButton;
