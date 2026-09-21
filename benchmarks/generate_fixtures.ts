import fs from "node:fs";
import path from "node:path";

const BENCH_DIR = path.resolve(__dirname);

// 1. Generate Codebase Haystack (60 files)
function generateCodebase() {
  const codeDir = path.join(BENCH_DIR, "codebase");
  const services = ["auth-service", "billing-service", "storage-service", "notification-service", "search-service", "inventory-service"];
  const fileTypes = ["routes.ts", "controller.ts", "service.ts", "model.ts", "validator.ts", "config.ts", "middleware.ts", "utils.ts", "errors.ts", "types.ts"];

  for (const svc of services) {
    const svcPath = path.join(codeDir, svc);
    fs.mkdirSync(svcPath, { recursive: true });

    for (const f of fileTypes) {
      const filePath = path.join(svcPath, f);
      let content = `/**\n * ${svc} - ${f}\n * Module responsible for ${svc} ${f.split('.')[0]} logic.\n */\n\n`;
      content += `export class ${svc.replace(/-/g, '_')}_${f.split('.')[0]} {\n`;
      content += `  // Standard logic implementation\n`;
      content += `  process(req: any) {\n    return { status: "ok", service: "${svc}" };\n  }\n}\n`;

      // Inject the needle in storage-service/middleware.ts
      if (svc === "storage-service" && f === "middleware.ts") {
        content = `/**\n * storage-service - middleware.ts\n * Pre-processing middleware for incoming object storage requests and presigned URLs.\n */\n\n`;
        content += `import { Request, Response, NextFunction } from 'express';\n\n`;
        content += `export function presignedUrlValidator(req: Request, res: Response, next: NextFunction) {\n`;
        content += `  // VULNERABILITY: Unvalidated X-Forwarded-Host used in internal AWS metadata redirection\n`;
        content += `  const forwardedHost = req.headers['x-forwarded-host'] as string;\n`;
        content += `  const targetHost = forwardedHost || req.hostname;\n`;
        content += `  const presignedEndpoint = \`http://\${targetHost}/latest/meta-data/iam/security-credentials/\`;\n`;
        content += `  req.headers['x-resolved-endpoint'] = presignedEndpoint;\n`;
        content += `  next();\n`;
        content += `}\n`;
      }

      fs.writeFileSync(filePath, content, "utf-8");
    }
  }
}

// 2. Generate High-Volume Telemetry Log (1,200 lines)
function generateTelemetry() {
  const logDir = path.join(BENCH_DIR, "telemetry");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, "production_access.log");

  const lines: string[] = [];
  const normalEndpoints = ["/health", "/api/v1/user/profile", "/api/v1/items", "/static/bundle.js", "/favicon.ico", "/api/v1/cart"];
  const ips = ["192.168.1.10", "10.0.4.12", "172.16.0.5", "10.244.0.15", "192.168.2.88"];

  for (let i = 1; i <= 1200; i++) {
    const timestamp = `2026-09-21T14:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z`;
    const ip = ips[i % ips.length];
    const ep = normalEndpoints[i % normalEndpoints.length];
    
    // Inject 4 specific credential stuffing attack lines
    if (i === 142) {
      lines.push(`${timestamp} [ALERT] 198.51.100.44 POST /api/v1/auth/login 401 - Credential stuffing attempt detected with wordlist rockyou-mini.txt`);
    } else if (i === 389) {
      lines.push(`${timestamp} [ALERT] 203.0.113.88 POST /api/v1/auth/login 401 - Repeated login failure from distributed proxy pool`);
    } else if (i === 741) {
      lines.push(`${timestamp} [ALERT] 198.51.100.72 POST /api/v1/auth/mfa/bypass 403 - MFA token brute-force anomaly detected`);
    } else if (i === 1055) {
      lines.push(`${timestamp} [CRITICAL] 203.0.113.199 POST /api/v1/auth/token 200 - Successful account hijack via credential stuffing replay`);
    } else {
      lines.push(`${timestamp} [INFO] ${ip} GET ${ep} 200 - Request processed in ${Math.floor(Math.random() * 40) + 5}ms`);
    }
  }

  fs.writeFileSync(logPath, lines.join("\n"), "utf-8");
}

// 3. Generate Knowledge Base Documents (30 docs)
function generateVault() {
  const vaultDir = path.join(BENCH_DIR, "vault", "articles");
  fs.mkdirSync(vaultDir, { recursive: true });

  const articles = [
    { name: "ebpf_xdp_packet_filter.md", title: "High-Performance Packet Filtering with eBPF XDP in the Linux Kernel", body: "Direct driver mode XDP allows dropping packets before kernel socket buffers are allocated." },
    { name: "kubernetes_cni_cilium.md", title: "Replacing kube-proxy with Cilium eBPF for Large-Scale Kubernetes Clusters", body: "Cilium replaces iptables overhead with BPF maps for O(1) service proxying." },
    { name: "distributed_tracing_opentelemetry.md", title: "Implementing W3C Trace Context Propagation with OpenTelemetry Go SDK", body: "Baggage and traceparent headers enable cross-service distributed context propagation." },
    { name: "postgresql_wal_streaming.md", title: "Zero Data Loss Postgres Streaming Replication and Patroni High Availability", body: "Configuring synchronous standby replication with consensus leases in etcd." },
    { name: "pytorch_distributed_fsdp.md", title: "Fully Sharded Data Parallel (FSDP) Memory Optimization in PyTorch 2.4", body: "Zero3 redundancy elimination by sharding optimizer states, gradients, and model parameters." },
    { name: "cuda_flash_attention_v3.md", title: "Kernel Optimization Patterns for FlashAttention-3 on NVIDIA Hopper GPUs", body: "Warp-specialized asynchronous tensor cores and TMA memory copy instructions." },
    { name: "linux_cgroups_v2_oom.md", title: "Memory Pressure Stall Information (PSI) and Cgroups v2 OOM Killer Tuning", body: "Using memory.high vs memory.max thresholds to trigger user-space proactive page eviction." },
    { name: "terraform_terragrunt_multiregion.md", title: "Multi-Region AWS Infrastructure Orchestration with Terragrunt and Terraform", body: "Dry infrastructure code with remote state locking and multi-account IAM role assumptions." },
    { name: "vllm_paged_attention_serving.md", title: "High-Throughput LLM Serving with PagedAttention and Dynamic Continuous Batching", body: "Virtual memory paging for key-value tensors in GPU high bandwidth memory." },
    { name: "wireguard_mesh_vpn_kernel.md", title: "Building Zero-Trust Mesh VPNs with In-Kernel WireGuard and Noise Protocol", body: "Cryptokey routing with UDP state tables and constant-time cryptography in kernel space." }
  ];

  for (const art of articles) {
    const p = path.join(vaultDir, art.name);
    fs.writeFileSync(p, `# ${art.title}\n\n${art.body}\n`, "utf-8");
  }
}

console.log("Generating benchmark fixtures...");
generateCodebase();
generateTelemetry();
generateVault();
console.log("Fixtures generated successfully!");
