import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { StatusState } from "../features/common/StatusState";
import styles from "./AppLayout.module.css";

function getRouteErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "页面发生未预期错误。";
}

export function RouteErrorBoundary() {
  const error = useRouteError();

  return (
    <div className={styles.routeError}>
      <StatusState
        tone="error"
        title="页面加载失败"
        description={getRouteErrorMessage(error)}
        actionLabel="重新加载"
        onAction={() => window.location.reload()}
      />
    </div>
  );
}
