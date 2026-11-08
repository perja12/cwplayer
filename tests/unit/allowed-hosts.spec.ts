import { describe, expect, it } from "vitest";
import { allowedHosts } from "../../vite.config";

describe("preview allowed hosts", () => {
  it("accepts Tailscale hostnames by default", () => {
    expect(allowedHosts(undefined)).toEqual([".ts.net"]);
    expect(allowedHosts("")).toEqual([".ts.net"]);
  });

  it("uses a comma-separated override for other tunnels", () => {
    expect(allowedHosts("example.ngrok.app, localhost ,")).toEqual([
      "example.ngrok.app",
      "localhost",
    ]);
  });

  it("trims whitespace and ignores blank entries", () => {
    expect(allowedHosts("  ,  ")).toEqual([".ts.net"]);
    expect(allowedHosts("fedora.tailb2020f.ts.net")).toEqual(["fedora.tailb2020f.ts.net"]);
  });
});
