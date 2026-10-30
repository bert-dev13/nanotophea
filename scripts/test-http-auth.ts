async function runHttpAuthTests() {
  console.log("=== STARTING HTTP AUTHENTICATION & ROUTE PROTECTION TESTS ===")
  const base = "http://localhost:3000"

  // 1. Valid Login
  console.log("\n[Test 1] Valid Login (admin@demo.com + admin123)...")
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@demo.com", password: "admin123" }),
  })

  if (loginRes.status !== 200) {
    throw new Error(`Expected status 200, got ${loginRes.status}: ${await loginRes.text()}`)
  }
  const loginData = await loginRes.json()
  if (!loginData.ok || loginData.user?.email !== "admin@demo.com" || !loginData.token) {
    throw new Error(`Unexpected login payload: ${JSON.stringify(loginData)}`)
  }

  // Check Set-Cookie
  const setCookie = loginRes.headers.get("set-cookie") || ""
  if (!setCookie.includes("nanotophea_session=") || !setCookie.toLowerCase().includes("httponly")) {
    throw new Error(`Missing or insecure Set-Cookie header: ${setCookie}`)
  }
  const match = setCookie.match(/nanotophea_session=([^;]+)/)
  const sessionToken = match ? match[1] : loginData.token
  console.log(`✔ Valid login succeeded: User ${loginData.user.displayName} (${loginData.user.email})`)
  console.log(`✔ HTTP-only secure session cookie received`)

  // 2. Invalid Password
  console.log("\n[Test 2] Invalid Password...")
  const wrongPassRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@demo.com", password: "wrongpassword123" }),
  })
  if (wrongPassRes.status !== 401) {
    throw new Error(`Expected status 401, got ${wrongPassRes.status}`)
  }
  const wrongPassData = await wrongPassRes.json()
  if (wrongPassData.error !== "Invalid email or password.") {
    throw new Error(`Expected generic error message, got: ${wrongPassData.error}`)
  }
  console.log("✔ Invalid password rejected with generic message: PASS")

  // 3. Invalid Email
  console.log("\n[Test 3] Invalid Email...")
  const wrongEmailRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@demo.com", password: "somepassword123" }),
  })
  if (wrongEmailRes.status !== 401) {
    throw new Error(`Expected status 401, got ${wrongEmailRes.status}`)
  }
  const wrongEmailData = await wrongEmailRes.json()
  if (wrongEmailData.error !== "Invalid email or password.") {
    throw new Error(`Expected generic error message, got: ${wrongEmailData.error}`)
  }
  console.log("✔ Unknown email rejected with identical generic message (no enumeration): PASS")

  // 4. Session Validation via Cookie
  console.log("\n[Test 4] Session Validation via Cookie...")
  const sessionRes = await fetch(`${base}/api/auth/session`, {
    method: "GET",
    headers: { Cookie: `nanotophea_session=${sessionToken}` },
  })
  if (sessionRes.status !== 200) {
    throw new Error(`Expected status 200, got ${sessionRes.status}`)
  }
  const sessionData = await sessionRes.json()
  if (!sessionData.user || sessionData.user.email !== "admin@demo.com") {
    throw new Error(`Session validation failed: ${JSON.stringify(sessionData)}`)
  }
  console.log(`✔ Active session verified for user: ${sessionData.user.email} [Role: ${sessionData.user.role}]`)

  // 5. Protected Route Access WITHOUT Cookie
  console.log("\n[Test 5] Protected Route Access without Cookie (/study/GuxwqeU3vnoP5P4xvRLJ)...")
  const protectedRes = await fetch(`${base}/study/GuxwqeU3vnoP5P4xvRLJ`, {
    method: "GET",
    redirect: "manual",
  })
  const isRedirect = protectedRes.status === 307 || protectedRes.status === 308 || protectedRes.status === 302
  const location = protectedRes.headers.get("location") || ""
  if (!isRedirect || !location.includes("signin=1")) {
    throw new Error(`Protected route was not redirected! Status: ${protectedRes.status}, Location: ${location}`)
  }
  console.log(`✔ Unauthorized request redirected to: ${location}`)

  // 6. Logout
  console.log("\n[Test 6] Logout and Session Invalidation...")
  const logoutRes = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: `nanotophea_session=${sessionToken}` },
  })
  if (logoutRes.status !== 200) {
    throw new Error(`Expected status 200, got ${logoutRes.status}`)
  }
  const logoutCookie = logoutRes.headers.get("set-cookie") || ""
  if (!logoutCookie.includes("nanotophea_session=;") && !logoutCookie.includes("Max-Age=0")) {
    throw new Error(`Logout cookie was not cleared: ${logoutCookie}`)
  }
  console.log("✔ Logout endpoint invalidated session and cleared cookie")

  // 7. Verify Invalidation
  console.log("\n[Test 7] Post-Logout Session Check...")
  const postLogoutSession = await fetch(`${base}/api/auth/session`, {
    method: "GET",
    headers: { Cookie: `nanotophea_session=${sessionToken}` },
  })
  const postLogoutData = await postLogoutSession.json()
  if (postLogoutData.user !== null) {
    throw new Error(`Session is still active after logout! ${JSON.stringify(postLogoutData)}`)
  }
  console.log("✔ Post-logout session is null: PASS")

  console.log("\n=== ALL HTTP AUTH & SECURITY TESTS PASSED SUCCESSFULLY ===")
}

runHttpAuthTests().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
