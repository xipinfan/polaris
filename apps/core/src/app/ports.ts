import net from "node:net";

const PORT_SEARCH_WINDOW = 100;
const LOOPBACK_HOST = "127.0.0.1";

async function listenOnPort<TServer extends net.Server>(server: TServer, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const handleError = (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(error);
    };
    const handleListening = () => {
      cleanup();
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to determine bound port"));
        return;
      }

      resolve(address.port);
    };
    const cleanup = () => {
      server.off("error", handleError);
      server.off("listening", handleListening);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(port, LOOPBACK_HOST);
  });
}

function isRecoverablePortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return code === "EADDRINUSE" || code === "EACCES";
}

export async function bindServerWithFallback<TServer extends net.Server>(
  createServer: () => TServer,
  preferredPort: number,
  usedPorts: Set<number>
): Promise<{ server: TServer; port: number }> {
  for (let port = preferredPort; port < preferredPort + PORT_SEARCH_WINDOW; port += 1) {
    if (usedPorts.has(port)) {
      continue;
    }

    const server = createServer();
    try {
      const boundPort = await listenOnPort(server, port);
      usedPorts.add(boundPort);
      return { server, port: boundPort };
    } catch (error) {
      if (!isRecoverablePortError(error)) {
        throw error;
      }
    }
  }

  const server = createServer();
  const boundPort = await listenOnPort(server, 0);
  usedPorts.add(boundPort);
  return { server, port: boundPort };
}
