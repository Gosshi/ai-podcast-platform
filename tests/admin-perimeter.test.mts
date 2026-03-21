import assert from "node:assert/strict";
import test from "node:test";

const perimeter = await import("../app/lib/adminPerimeter.ts");

test("parseAdminIpRules supports exact IPs and IPv4 CIDR", () => {
  const rules = perimeter.parseAdminIpRules("203.0.113.4,198.51.100.0/24");
  assert.equal(rules.length, 2);
});

test("isIpAllowed matches exact IP entries", () => {
  const rules = perimeter.parseAdminIpRules("203.0.113.4");
  assert.equal(perimeter.isIpAllowed("203.0.113.4", rules), true);
  assert.equal(perimeter.isIpAllowed("203.0.113.5", rules), false);
});

test("isIpAllowed matches IPv4 CIDR entries", () => {
  const rules = perimeter.parseAdminIpRules("198.51.100.0/24");
  assert.equal(perimeter.isIpAllowed("198.51.100.9", rules), true);
  assert.equal(perimeter.isIpAllowed("198.51.101.9", rules), false);
});

test("hasValidAdminBasicAuth validates expected credentials", () => {
  const header = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
  assert.equal(perimeter.hasValidAdminBasicAuth(header, "admin", "secret"), true);
  assert.equal(perimeter.hasValidAdminBasicAuth(header, "admin", "wrong"), false);
});

test("isAdminPerimeterTarget covers admin pages and admin APIs", () => {
  assert.equal(perimeter.isAdminPerimeterTarget("/admin/trends"), true);
  assert.equal(perimeter.isAdminPerimeterTarget("/api/admin/access"), true);
  assert.equal(perimeter.isAdminPerimeterTarget("/decisions"), false);
});
