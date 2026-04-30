/**
 * Human context for terminal Render deploy statuses (GET deploy returns status only;
 * exact errors live in deploy logs in the Dashboard).
 */
export function deployTerminalGuidance(statusRaw: string): string {
  const s = String(statusRaw || "").toLowerCase();
  switch (s) {
    case "build_failed":
      return (
        "Render could not complete the build (dependencies, compile, or invalid build/start commands). " +
        "This is separate from API credentials: your API key already created the service. " +
        "Open this service in the Render Dashboard and read the deploy log for the failing command output."
      );
    case "pre_deploy_failed":
      return (
        "The pre-deploy step failed. Check the deploy log in the Dashboard for the command output."
      );
    case "update_failed":
      return (
        "The deploy/update phase failed after build. Check deploy logs and health check settings in the Dashboard."
      );
    case "canceled":
      return "Deploy was canceled.";
    default:
      return "See deploy logs in the Render Dashboard for details.";
  }
}
