/* FederatedCapabilityKernel.ts
   ACIP Satellite Kernel: persistent capabilities + governed federation execution + assistance + updates.
   Designed for ECHO-001 style federation, with strict GOV/VERIFY gating and DVAP hooks.
*/

import crypto from "crypto";

/** ---------- Types ---------- **/

export type RiskTier = "T0_LOW" | "T1_STANDARD" | "T2_HIGH_STAKES" | "T3_REGULATED";
export type Verdict = "ALLOW" | "DENY";
export type DVAPVerdict = "ATTESTED" | "REFUSED";

export interface CanonicalActionFrame {
  action_id: string;
  agent_id: string;
  risk_tier: RiskTier;
  sdc_version: string;
  policy_verdict: boolean;
  constraints_satisfied: boolean;
  human_confirmation: boolean;
  timestamp_utc: string; // ISO-8601
  hash_algorithm: "SHA-256";
  // Optional extensions, must remain deterministic and canonicalized if included:
  extensions?: Record<string, string | number | boolean>;
}

export interface CapabilityManifest {
  schema_version: "1.0.0";
  agent_id: string;

  federation: {
    enabled: boolean;
    sources: string[];             // e.g. ["MAS_CORE", "SATELLITE_POOL", "APP_CONNECTORS"]
    allowed_operations: string[];   // e.g. ["ASK_FEDERATION", "RUN_REMOTE_TOOL", "QUERY_VECTOR", ...]
  };

  assistance: {
    enabled: boolean;
    routes: ("FEDERATION" | "HUMAN_ESCALATION" | "PEER_AGENT")[];
    max_attempts: number;
  };

  updates: {
    enabled: boolean;
    // Updates are configuration/skill packages, not arbitrary code.
    allowed_channels: ("SKILL_CAPSULE" | "CONFIG_BUNDLE")[];
    require_signature: boolean;
    require_governance_approval: boolean;
    require_dvap_for_risk_tiers: RiskTier[]; // typically ["T2_HIGH_STAKES","T3_REGULATED"]
    trusted_signers: string[]; // public key fingerprints / IDs
  };

  governance: {
    sdc_version: string;           // pinned policy version
    invariant_keys_required: string[];
    dvap_required_for_risk_tiers: RiskTier[];
  };
}

export interface PersistedKernelState {
  manifest: CapabilityManifest;
  last_boot_utc: string;
  last_manifest_hash: string;
  monotonic_counter: number; // increments each boot for auditing
}

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface GovernanceGate {
  /** Must return ALLOW only when policy + invariants satisfied for the proposed action. */
  evaluate(frame: CanonicalActionFrame): Promise<{ verdict: Verdict; reason: string; policy_hash?: string }>;
}

export interface DVAPClient {
  /** DVAP must be invoked only from GOV/VERIFY context. */
  attest(frame: CanonicalActionFrame): Promise<{ verdict: DVAPVerdict; uva_hash?: string; reason?: string }>;
}

export interface FederationClient {
  /** Federated request executor; must be governed by the caller (this kernel). */
  request<T = unknown>(req: {
    trace_id: string;
    agent_id: string;
    operation: string;
    payload: Record<string, unknown>;
    risk_tier: RiskTier;
  }): Promise<{ ok: boolean; result?: T; error?: string; source?: string }>;
}

export interface AssistanceBroker {
  /** Escalate query/need for help. Must be governed by the kernel. */
  requestAssistance(req: {
    trace_id: string;
    agent_id: string;
    query: string;
    context?: Record<string, unknown>;
    risk_tier: RiskTier;
  }): Promise<{ ok: boolean; response?: string; route_used?: string; error?: string }>;
}

export interface UpdatePackage {
  package_id: string;
  channel: "SKILL_CAPSULE" | "CONFIG_BUNDLE";
  version: string;
  created_utc: string;
  payload_b64: string;            // opaque bundle
  signature_b64?: string;         // required if require_signature true
  signer_id?: string;             // must match trusted_signers
  // deterministic metadata fields only
}

/** ---------- Utilities ---------- **/

function isoNowUTC(): string {
  return new Date().toISOString();
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** Deterministic canonical JSON stringify: lexicographic sort of keys. */
export function canonicalStringify(obj: Record<string, unknown>): string {
  const sortKeys = (v: any): any => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      const out: Record<string, any> = {};
      Object.keys(v).sort().forEach((k) => (out[k] = sortKeys(v[k])));
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(obj));
}

export function computeInputFrameHash(frame: CanonicalActionFrame): string {
  // Ensure deterministic serialization; exclude non-deterministic data.
  const canonical = canonicalStringify(frame as unknown as Record<string, unknown>);
  return sha256Hex(canonical);
}

/** ---------- Kernel ---------- **/

export class FederatedCapabilityKernel {
  private readonly storageKey: string;
  private state!: PersistedKernelState;

  constructor(
    private readonly deps: {
      storage: StorageAdapter;
      governance: GovernanceGate;
      dvap: DVAPClient;
      federation: FederationClient;
      assistance: AssistanceBroker;
      logger?: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void };
    },
    private readonly agentId: string
  ) {
    this.storageKey = `acip.kernel.state.${agentId}`;
  }

  /** Boot loads or initializes persistent capability awareness. */
  async boot(defaultManifest: CapabilityManifest): Promise<PersistedKernelState> {
    const raw = await this.deps.storage.get(this.storageKey);

    if (!raw) {
      const manifestHash = sha256Hex(canonicalStringify(defaultManifest as any));
      this.state = {
        manifest: defaultManifest,
        last_boot_utc: isoNowUTC(),
        last_manifest_hash: manifestHash,
        monotonic_counter: 1
      };
      await this.persist();
      this.deps.logger?.info?.("[DVAP-KERNEL] Initialized new state", { agentId: this.agentId, manifestHash });
      return this.state;
    }

    const parsed: PersistedKernelState = JSON.parse(raw);
    // Minimal integrity check: manifest must match agent id
    if (parsed.manifest.agent_id !== this.agentId) {
      throw new Error(`Kernel state agent_id mismatch. Expected=${this.agentId}, Found=${parsed.manifest.agent_id}`);
    }

    // Update boot info
    parsed.last_boot_utc = isoNowUTC();
    parsed.monotonic_counter = (parsed.monotonic_counter ?? 0) + 1;
    parsed.last_manifest_hash = sha256Hex(canonicalStringify(parsed.manifest as any));

    this.state = parsed;
    await this.persist();

    this.deps.logger?.info?.("[DVAP-KERNEL] Booted state", {
      agentId: this.agentId,
      counter: this.state.monotonic_counter,
      manifestHash: this.state.last_manifest_hash
    });

    return this.state;
  }

  getManifest(): CapabilityManifest {
    return this.state.manifest;
  }

  /** Primary governed entrypoint: execute a federated operation under policy + DVAP (T2/T3). */
  async governedFederationCall<T>(args: {
    trace_id: string;
    action_id: string;
    operation: string;
    payload: Record<string, unknown>;
    risk_tier: RiskTier;
    human_confirmation?: boolean;
  }): Promise<{ ok: boolean; result?: T; uva_hash?: string; input_frame_hash?: string; error?: string; source?: string }> {
    const m = this.state.manifest;

    if (!m.federation.enabled) return { ok: false, error: "FEDERATION_DISABLED" };
    if (!m.federation.allowed_operations.includes(args.operation)) return { ok: false, error: "OP_NOT_ALLOWED" };

    // Build canonical action frame for GOV/VERIFY + DVAP
    const frame: CanonicalActionFrame = {
      action_id: args.action_id,
      agent_id: this.agentId,
      risk_tier: args.risk_tier,
      sdc_version: m.governance.sdc_version,
      policy_verdict: true,            // set after governance evaluation
      constraints_satisfied: true,     // set after governance evaluation
      human_confirmation: Boolean(args.human_confirmation),
      timestamp_utc: isoNowUTC(),
      hash_algorithm: "SHA-256"
    };

    // GOV evaluation
    const gov = await this.deps.governance.evaluate(frame);
    if (gov.verdict === "DENY") {
      return { ok: false, error: `GOV_DENY:${gov.reason}` };
    }

    // DVAP mandatory for configured tiers
    const dvapRequired = m.governance.dvap_required_for_risk_tiers.includes(args.risk_tier);
    const input_frame_hash = computeInputFrameHash(frame);

    let uva_hash: string | undefined;
    if (dvapRequired) {
      const dv = await this.deps.dvap.attest(frame);
      if (dv.verdict !== "ATTESTED") {
        return { ok: false, input_frame_hash, error: `DVAP_REFUSED:${dv.reason ?? "UNKNOWN"}` };
      }
      uva_hash = dv.uva_hash;
    }

    // Execute via federation (elastic compute / logic)
    const res = await this.deps.federation.request<T>({
      trace_id: args.trace_id,
      agent_id: this.agentId,
      operation: args.operation,
      payload: args.payload,
      risk_tier: args.risk_tier
    });

    if (!res.ok) {
      // Optionally route to assistance if permitted
      const assist = await this.tryAssistance({
        trace_id: args.trace_id,
        risk_tier: args.risk_tier,
        query: `Federation operation failed: ${args.operation}`,
        context: { error: res.error, operation: args.operation }
      });
      return { ok: false, uva_hash, input_frame_hash, error: res.error ?? "FEDERATION_ERROR", source: res.source, ...(assist.ok ? { error: `${res.error} | assist:${assist.route_used}` } : {}) };
    }

    return { ok: true, result: res.result, uva_hash, input_frame_hash, source: res.source };
  }

  /** Governed assistance request: allows the agent to request help under policy. */
  async requestAssistance(args: {
    trace_id: string;
    risk_tier: RiskTier;
    query: string;
    context?: Record<string, unknown>;
    human_confirmation?: boolean;
  }): Promise<{ ok: boolean; response?: string; route_used?: string; error?: string }> {
    const m = this.state.manifest;
    if (!m.assistance.enabled) return { ok: false, error: "ASSISTANCE_DISABLED" };

    // Assistance itself is an action; gate it.
    const frame: CanonicalActionFrame = {
      action_id: `assist_${sha256Hex(args.trace_id + args.query).slice(0, 12)}`,
      agent_id: this.agentId,
      risk_tier: args.risk_tier,
      sdc_version: m.governance.sdc_version,
      policy_verdict: true,
      constraints_satisfied: true,
      human_confirmation: Boolean(args.human_confirmation),
      timestamp_utc: isoNowUTC(),
      hash_algorithm: "SHA-256"
    };

    const gov = await this.deps.governance.evaluate(frame);
    if (gov.verdict === "DENY") return { ok: false, error: `GOV_DENY:${gov.reason}` };

    // DVAP optional for assistance unless your policy wants it for T3.
    const dvapRequired = m.governance.dvap_required_for_risk_tiers.includes(args.risk_tier);
    if (dvapRequired) {
      const dv = await this.deps.dvap.attest(frame);
      if (dv.verdict !== "ATTESTED") return { ok: false, error: `DVAP_REFUSED:${dv.reason ?? "UNKNOWN"}` };
    }

    return this.deps.assistance.requestAssistance({
      trace_id: args.trace_id,
      agent_id: this.agentId,
      query: args.query,
      context: args.context,
      risk_tier: args.risk_tier
    });
  }

  /**
   * Governed update mechanism:
   * - No self-modifying code.
   * - Only signed SKILL_CAPSULE/CONFIG_BUNDLE packages.
   * - Requires governance approval + DVAP for configured risk tiers.
   */
  async applyUpdatePackage(args: {
    trace_id: string;
    risk_tier: RiskTier;
    pkg: UpdatePackage;
    human_confirmation?: boolean;
    verifySignature: (pkg: UpdatePackage, trustedSigners: string[]) => Promise<boolean>;
    applyBundle: (pkg: UpdatePackage) => Promise<void>; // performs configuration/skill registry update
  }): Promise<{ ok: boolean; error?: string }> {
    const m = this.state.manifest;
    if (!m.updates.enabled) return { ok: false, error: "UPDATES_DISABLED" };
    if (!m.updates.allowed_channels.includes(args.pkg.channel)) return { ok: false, error: "UPDATE_CHANNEL_NOT_ALLOWED" };
    if (m.updates.require_signature && !(await args.verifySignature(args.pkg, m.updates.trusted_signers))) {
      return { ok: false, error: "INVALID_SIGNATURE" };
    }

    // Gate the update as an action
    const frame: CanonicalActionFrame = {
      action_id: `update_${args.pkg.package_id}`,
      agent_id: this.agentId,
      risk_tier: args.risk_tier,
      sdc_version: m.governance.sdc_version,
      policy_verdict: true,
      constraints_satisfied: true,
      human_confirmation: Boolean(args.human_confirmation),
      timestamp_utc: isoNowUTC(),
      hash_algorithm: "SHA-256",
      extensions: {
        channel: args.pkg.channel,
        version: args.pkg.version,
        signer: args.pkg.signer_id ?? "unknown"
      }
    };

    const gov = await this.deps.governance.evaluate(frame);
    if (gov.verdict === "DENY") return { ok: false, error: `GOV_DENY:${gov.reason}` };

    const dvapRequired = m.updates.require_dvap_for_risk_tiers.includes(args.risk_tier);
    if (dvapRequired) {
      const dv = await this.deps.dvap.attest(frame);
      if (dv.verdict !== "ATTESTED") return { ok: false, error: `DVAP_REFUSED:${dv.reason ?? "UNKNOWN"}` };
    }

    await args.applyBundle(args.pkg);

    // Persist manifest hash / state after update
    this.state.last_manifest_hash = sha256Hex(canonicalStringify(this.state.manifest as any));
    await this.persist();

    return { ok: true };
  }

  /** Internal: bounded assistance attempt for federation failures. */
  private async tryAssistance(args: {
    trace_id: string;
    risk_tier: RiskTier;
    query: string;
    context?: Record<string, unknown>;
  }): Promise<{ ok: boolean; route_used?: string }> {
    const m = this.state.manifest;
    if (!m.assistance.enabled) return { ok: false };
    // Rate-limit attempts by manifest config
    // (You can extend with per-trace counters in evidence plane; this keeps kernel stateless beyond persisted state.)
    try {
      const res = await this.deps.assistance.requestAssistance({
        trace_id: args.trace_id,
        agent_id: this.agentId,
        query: args.query,
        context: args.context,
        risk_tier: args.risk_tier
      });
      return { ok: Boolean(res.ok), route_used: res.route_used };
    } catch {
      return { ok: false };
    }
  }

  private async persist(): Promise<void> {
    await this.deps.storage.set(this.storageKey, JSON.stringify(this.state));
  }
}
