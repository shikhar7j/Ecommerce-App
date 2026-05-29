import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.jsx';

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Auth0Provider
      domain="dev-g5rzigi8ap7wpsu0.jp.auth0.com"
      clientId="XiCdGqTCovLS6R3DIWGJWJDGHNaFvomH"
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
    >
      <App />
    </Auth0Provider>
  </StrictMode>
);
