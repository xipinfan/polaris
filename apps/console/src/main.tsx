import React from "react";
import ReactDOM from "react-dom/client";
import { loader } from "@monaco-editor/react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import * as monaco from "monaco-editor";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { ToastProvider } from "./features/feedback/ToastProvider";
import { ConsoleI18nProvider } from "./i18n/I18nProvider";
import { ConsoleQueryProvider } from "./lib/query/queryProvider";
import "antd/dist/reset.css";
import "./styles/global.css";

// 使用本地打包的 monaco-editor，避免运行时从 CDN 加载（代理环境下 CDN 请求会被拦截）
loader.config({ monaco });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#3556a8",
          colorInfo: "#3556a8",
          colorBgBase: "#f4f7fb",
          colorTextBase: "#101828",
          borderRadius: 16,
          borderRadiusLG: 22,
          boxShadowSecondary: "0 24px 54px rgba(16, 24, 40, 0.08)",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"",
        },
        components: {
          Button: {
            controlHeight: 40,
            borderRadius: 14,
            fontWeight: 600,
            primaryShadow: "none",
            defaultShadow: "none",
            colorPrimaryHover: "#4163b7",
            colorPrimaryActive: "#2b4b9a",
            defaultBorderColor: "#d7dee8",
            defaultHoverBorderColor: "#c5d0df",
            defaultHoverColor: "#0f172a",
          },
          Input: {
            controlHeight: 42,
            borderRadius: 14,
            hoverBorderColor: "#c5d0df",
            activeBorderColor: "#9db1d9",
          },
          Select: {
            controlHeight: 42,
            borderRadius: 14,
            optionSelectedBg: "#eef3ff",
            optionActiveBg: "#f4f7fb",
          },
          Segmented: {
            trackBg: "#f3f6fb",
            itemSelectedBg: "#ffffff",
            itemHoverBg: "#f8fafc",
            itemSelectedColor: "#101828",
            borderRadius: 14,
            trackPadding: 4,
          },
          Switch: {
            trackHeight: 28,
            trackMinWidth: 48,
            handleSize: 22,
            colorPrimary: "#3556a8",
            colorPrimaryHover: "#4163b7",
          },
          Modal: {
            borderRadiusLG: 28,
          },
          Drawer: {
            footerPaddingBlock: 16,
            footerPaddingInline: 16,
          },
          Dropdown: {
            borderRadiusLG: 16,
            controlPaddingHorizontal: 12,
          },
          Badge: {
            dotSize: 8,
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
      <ConsoleQueryProvider>
        <ConsoleI18nProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </ConsoleI18nProvider>
      </ConsoleQueryProvider>
    </ConfigProvider>
  </React.StrictMode>
);
