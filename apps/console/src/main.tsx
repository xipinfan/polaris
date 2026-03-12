import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { ToastProvider } from "./features/feedback/ToastProvider";
import { ConsoleI18nProvider } from "./i18n/I18nProvider";
import "antd/dist/reset.css";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#3159c9",
          colorInfo: "#3159c9",
          colorBgBase: "#f3f5f8",
          colorTextBase: "#101828",
          borderRadius: 16,
          borderRadiusLG: 22,
          boxShadowSecondary: "0 24px 54px rgba(16, 24, 40, 0.08)",
          fontFamily: "\"SF Pro Display\", \"Segoe UI Variable\", \"PingFang SC\", sans-serif",
        },
        components: {
          Button: {
            controlHeight: 40,
            borderRadius: 14,
            fontWeight: 600,
            primaryShadow: "none",
            defaultShadow: "none",
            colorPrimaryHover: "#3b61c8",
            colorPrimaryActive: "#284da8",
          },
          Card: {
            borderRadiusLG: 24,
          },
          Tag: {
            borderRadiusSM: 999,
          },
        },
      }}
    >
      <ConsoleI18nProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ConsoleI18nProvider>
    </ConfigProvider>
  </React.StrictMode>
);
