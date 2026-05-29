import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import styles from "./Login.module.css";
import userTypes from "./userTypes";
import LoginButton from "./LoginButton";

const Login = () => {
  const [selectedType, setSelectedType] = useState(null);

  const { isLoading, error, isAuthenticated, user } = useAuth0();

  console.log("Auth0 State:", { isLoading, error, isAuthenticated, user });

  if (isLoading) return <p>Loading... (isLoading: true)</p>;
  if (error) return <p>Auth Error: {error.message}</p>;

  return (
    <div className={styles.Container}>
      <div className={styles.Dashboard}>
        <h1 className={styles.Title}>Welcome to MarketPlace</h1>
        <h3 className={styles.Title}>
          Connect with suppliers, retailers, and customers
        </h3>
      </div>
      <div className={styles.Login}>
        <h2 className={styles.Subtitle}>Sign in</h2>
        <h4 className={styles.Subtitle}>Access your Account</h4>
        <div className={styles.userTypeOptions}>
          {userTypes.map((userType) => (
            <button
              key={userType.type}
              className={`${styles.userTypeCard} ${
                selectedType === userType.type ? styles.selected : ""
              }`}
              type="button"
              onClick={() => setSelectedType(userType.type)}
            >
              <span style={{ fontSize: 32, marginRight: 16 }}>
                <userType.icon />
              </span>
              <div>
                <div>{userType.label}</div>
                <small>{userType.description}</small>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.loginActions}>
        <LoginButton />
      </div>
    </div>
  );
};

export default Login;
