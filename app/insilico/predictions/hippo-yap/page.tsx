import { redirect } from "next/navigation"

/** Legacy path — Hippo–YAP lives at /insilico/predictions/yap */
export default function Page() {
  redirect("/insilico/predictions/yap")
}
