import https from "https";
import { IncomingMessage } from "http";

export function httpsGet(
  hostname: string,
  path: string,
  headers: Record<string, string>
): Promise<{ body: string; status: number }> {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "GET", headers }, (res: IncomingMessage) => {
      let body = "";
      res.on("data", (c: Buffer) => (body += c.toString()));
      res.on("end", () => resolve({ body, status: res.statusCode ?? 0 }));
    });
    req.on("error", reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}
