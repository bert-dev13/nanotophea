import { spawn } from "node:child_process"

const port = "3000"
const bin = process.env.NGROK_BIN || "ngrok"
let announced = false

const child = spawn(bin, ["http", port, "--log", "stdout", "--log-format", "json"], {
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
})

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error("ngrok is not installed or not on PATH.")
    console.error("Install it from https://ngrok.com/download and run this once:")
    console.error("  ngrok config add-authtoken <token from the ngrok dashboard>")
    console.error("Do not put that token in this project or in Git.")
  } else {
    console.error(error.message)
  }
  process.exit(1)
})

child.stdout.on("data", (chunk) => {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      process.stdout.write(`${line}\n`)
      continue
    }
    const text = `${event.msg || ""} ${event.err || ""}`
    if (/authtoken|ERR_NGROK_4018|authentication failed/i.test(text)) {
      console.error("")
      console.error("ngrok needs your account token. It is stored by ngrok, not in this repository.")
      console.error("Get the token from https://dashboard.ngrok.com/get-started/your-authtoken")
      console.error("Then run this once in a terminal:")
      console.error("  ngrok config add-authtoken <your-token>")
      console.error("")
    }
    const url = typeof event.url === "string" ? event.url : ""
    if (!announced && url.startsWith("https://")) {
      announced = true
      console.log("")
      console.log("PUBLIC CLIENT TEST URL:")
      console.log(url)
      console.log("")
      console.log("Leave this window open. Ctrl+C stops the app, ADME, and this link.")
      console.log("")
    }
  }
})

child.stderr.on("data", (chunk) => {
  const text = chunk.toString()
  process.stderr.write(text)
  if (/authtoken|ERR_NGROK_4018/i.test(text)) {
    console.error("Run once: ngrok config add-authtoken <your-token>")
    console.error("The token stays in the ngrok config on this computer. Do not commit it.")
  }
})

child.on("exit", (code) => {
  process.exit(code ?? 0)
})

process.on("SIGINT", () => child.kill("SIGINT"))
process.on("SIGTERM", () => child.kill("SIGTERM"))
