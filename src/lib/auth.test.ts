import test from "node:test";
import assert from "node:assert/strict";
import { hasFullAccess, isSuperAdmin, isVcOffice } from "./auth";

test("super_admin has full access", () => {
  assert.equal(isSuperAdmin({ role: "super_admin" }), true);
  assert.equal(isVcOffice({ role: "super_admin" }), false);
  assert.equal(hasFullAccess({ role: "super_admin" }), true);
});

test("vc_office has full access but is not a super admin", () => {
  assert.equal(isSuperAdmin({ role: "vc_office" }), false);
  assert.equal(isVcOffice({ role: "vc_office" }), true);
  assert.equal(hasFullAccess({ role: "vc_office" }), true);
});

test("event admin does not have full access", () => {
  assert.equal(isSuperAdmin({ role: "admin" }), false);
  assert.equal(isVcOffice({ role: "admin" }), false);
  assert.equal(hasFullAccess({ role: "admin" }), false);
  assert.equal(hasFullAccess(null), false);
});
