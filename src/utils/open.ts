import { spawn } from "node:child_process";
import os from "node:os";

export function openInBrowser(target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    let command: string;
    let args: string[];

    if (platform === "darwin") {
      command = "open";
      args = [target];
    } else if (platform === "win32") {
      command = "cmd";
      args = ["/c", "start", "", `"${target}"`];
    } else {
      command = "xdg-open";
      args = [target];
    }

    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Failed to open ${target}`));
      }
    });
  });
}
