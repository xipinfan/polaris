import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { ConsoleI18nProvider } from "./i18n/I18nProvider";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConsoleI18nProvider>
      <RouterProvider router={router} />
    </ConsoleI18nProvider>
  </React.StrictMode>
);
