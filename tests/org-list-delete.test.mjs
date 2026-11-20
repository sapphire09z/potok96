import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = readFileSync("src/app/admin/orgs/page.js", "utf8");

test("organization list includes delete button", () => {
  assert.ok(file.includes(
    'import ResourceDeleteButton from "@/components/admin/ResourceDeleteButton";'
  ));

  const listing = file.split("items.map(item =>")[1];
  assert.ok(listing, "Organization listing must exist");
  assert.ok(listing.includes(
    '<ResourceDeleteButton kind="orgs" id={item.id} title={item.title}'
  ));
});

test("delete button receives version and retry state", () => {
  assert.ok(file.includes('updatedAt={item.updatedAt.toISOString()}'));
  assert.ok(file.includes('deleting={item.status === "DELETING"}'));
  assert.ok(file.includes('["DRAFT", "PUBLISHED", "DELETING"]'));
});
