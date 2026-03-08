import React from "react";
import ReactDOM from "react-dom/client";
import { ExtensionI18nProvider } from "./i18n/I18nProvider";
import { Popup } from "./pages/Popup";
import "./popup.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ExtensionI18nProvider>
      <Popup />
    </ExtensionI18nProvider>
  </React.StrictMode>
);
