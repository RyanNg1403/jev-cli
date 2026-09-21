import { describe, it, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const CLI_PATH = path.resolve(__dirname, "../jev");

function runJev(args: string[], input?: string): { stdout: string; stderr: string; status: number } {
  const res = spawnSync(CLI_PATH, args, {
    input,
    encoding: "utf-8",
    env: { ...process.env },
  });
  return {
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    status: res.status ?? 0,
  };
}

describe("CLI Live Integration Tests", () => {
  it("executes 'jev models' and returns active model", () => {
    const res = runJev(["models"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("jev-latest");
    expect(res.stdout).toContain("ACTIVE");
  });

  it("executes 'jev choice -q' on stdin and outputs winning ID", () => {
    const res = runJev(
      ["choice", "--choices", "database,network,auth,frontend", "-i", "Which team handles this?", "-q"],
      "Database replica deadlock on users table"
    );
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("database");
  });

  it("executes 'jev choice --tsv' and outputs tab-separated fields", () => {
    const res = runJev(
      ["choice", "--choices", "database,frontend", "-i", "Which team handles this?", "--tsv"],
      "Database replica deadlock on users table"
    );
    expect(res.status).toBe(0);
    const parts = res.stdout.trim().split("\t");
    expect(parts[0]).toBe("database");
    expect(parts.length).toBe(3);
  });

  it("executes 'jev noul' with exit code 0 when condition holds", () => {
    const res = runJev(
      ["noul", "-i", "Does this mention database replication?", "--threshold", "0.8"],
      "Postgres replication stream interrupted on replica 3"
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("true");
  });

  it("executes 'jev noul' with exit code 1 when condition does not hold", () => {
    const res = runJev(
      ["noul", "-i", "Does this mention Kubernetes cluster autoscaling?", "--threshold", "0.8"],
      "Postgres replication stream interrupted on replica 3"
    );
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("false");
  });

  it("executes 'jev noul --filter' to act as semantic grep over lines", () => {
    const inputLines = [
      "CRITICAL: Out of memory in redis cache",
      "INFO: User 42 logged in successfully",
      "ERROR: Redis connection timeout on port 6379",
    ].join("\n");

    const res = runJev(
      ["noul", "-i", "Is this line reporting an error, crash, or memory failure?", "--filter", "--stream"],
      inputLines
    );

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("CRITICAL: Out of memory in redis cache");
    expect(res.stdout).toContain("ERROR: Redis connection timeout on port 6379");
    expect(res.stdout).not.toContain("INFO: User 42 logged in successfully");
  });

  it("executes 'jev score' and outputs winning descriptive level", () => {
    const res = runJev(
      ["score", "--levels", "minor,moderate,catastrophic", "-i", "Rate failure severity", "-q"],
      "Total power loss in datacenter: all servers offline"
    );
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("catastrophic");
  });

  it("executes 'jev eval' and evaluates multiple questions in parallel", () => {
    const spec = JSON.stringify({
      team: { type: "choice", choices: ["billing", "auth"], instructions: "Responsible team" },
      urgent: { type: "noul", instructions: "Is this urgent?" },
    });

    const res = runJev(["eval", "--spec", spec], "Unauthorized password reset attempt detected");
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.team.choice).toBe("auth");
    expect(typeof parsed.urgent.noul).toBe("number");
  });

  it("handles null-delimited I/O (-z, --null)", () => {
    const res = runJev(
      ["choice", "--choices", "db,auth", "-i", "Subsystem", "-q", "-z"],
      "Postgres error"
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toBe("db\0");
  });

  it("returns exit code 2 on missing required argument", () => {
    const res = runJev(["choice", "--choices", "a,b"]); // Missing -i
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("Error: --instruction (-i) is required");
  });
});
