import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "antd";
import { useToast } from "../../../../features/feedback/ToastProvider";
import { queryKeys } from "../../../../lib/query/queryKeys";
import { apiClient } from "../../../../services/apiClient";
import localStyles from "./index.module.less";

type SettingsSystemProxyCardProps = {
  enabled: boolean;
  proxyPort: number;
};

export function SettingsSystemProxyCard({
  enabled,
  proxyPort,
}: SettingsSystemProxyCardProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const toggleMutation = useMutation({
    mutationFn: (nextEnabled: boolean) => apiClient.setSystemProxy(nextEnabled),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.home.overview }),
      ]);
    },
  });

  const nextEnabled = !enabled;

  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>系统代理</span>
          <h3>System HTTP/HTTPS Proxy</h3>
        </div>
        <span
          className={`${localStyles.statusBadge} ${
            enabled ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted
          }`}
        >
          {enabled ? "已启用" : "未启用"}
        </span>
      </div>

      <p className={localStyles.summary}>
        一键开关系统级 HTTP/HTTPS 代理，启用后会将系统代理指向 Polaris。
      </p>

      <div className={localStyles.metricRow}>
        <span>代理地址</span>
        <strong>{`127.0.0.1:${proxyPort}`}</strong>
      </div>

      <Button
        className={localStyles.actionButton}
        loading={toggleMutation.isPending}
        onClick={() => {
          void toggleMutation
            .mutateAsync(nextEnabled)
            .then((result) => {
              showToast(result.enabled ? "系统代理已开启" : "系统代理已关闭", "success");
            })
            .catch((error: unknown) => {
              showToast(error instanceof Error ? error.message : "系统代理切换失败", "error");
            });
        }}
        type={enabled ? "default" : "primary"}
      >
        {enabled ? "关闭系统代理" : "开启系统代理"}
      </Button>
    </section>
  );
}
