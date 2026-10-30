import assert from "node:assert/strict"
import test from "node:test"
import { normalizeAdmeSmiles, readAdmetServiceConfig } from "./hosted"

test("production ignores a localhost ADME service", () => {
  assert.equal(readAdmetServiceConfig({ NODE_ENV: "production", ADMET_API_URL: "http://localhost:8000" }), null)
  assert.equal(readAdmetServiceConfig({ NODE_ENV: "production", ADMET_API_URL: "http://127.0.0.1:8000" }), null)
  const hosted = readAdmetServiceConfig({ NODE_ENV: "production", ADMET_API_URL: "https://admet.example.com/" })
  assert.equal(hosted?.base, "https://admet.example.com")
})

test("a missing service URL does not fall back to a local worker", () => {
  assert.equal(readAdmetServiceConfig({ NODE_ENV: "production" }), null)
  assert.equal(readAdmetServiceConfig({ NODE_ENV: "development", ADMET_API_URL: "not a url" }), null)
})

test("SMILES used for cache lookup drop surrounding and internal spaces", () => {
  assert.equal(normalizeAdmeSmiles("  CCO  "), "CCO")
  assert.equal(normalizeAdmeSmiles("C1 CC O"), "C1CCO")
  assert.equal(normalizeAdmeSmiles(""), undefined)
})
