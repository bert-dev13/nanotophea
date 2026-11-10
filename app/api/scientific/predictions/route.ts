import { getSessionUserFromRequest } from "@/lib/auth/session"
import { query, queryOne } from "@/lib/db/mysql"
import { postScientificPredictions } from "@/lib/predictions/predictionsRoute"

/**
 * Modes:
 * - validated | predict | (default): registered model only; currently all models are null → not_configured
 * - exploratory_simulation | prototype: requires auth, study access, and acknowledgeExploratory=true
 *
 * Actor identity always comes from the authenticated session. Client-supplied actor IDs are ignored.
 * This route computes exploratory results; persistence is performed by authenticated server actions
 * that must stamp acknowledgement metadata consistently with the run id.
 */
export async function POST(request: Request) {
  return postScientificPredictions(request, {
    getSessionUser: async (req) => {
      const user = await getSessionUserFromRequest(req)
      return user ? { id: user.id } : null
    },
    loadStudyAccess: async (studyId) => {
      const study = await queryOne<any>("SELECT owner_id FROM studies WHERE id = ?", [studyId])
      if (!study) return null
      const members = await query<any>("SELECT user_id FROM study_members WHERE study_id = ?", [studyId])
      return {
        ownerId: study.owner_id as string | undefined,
        memberIds: members.map((row: { user_id: string }) => row.user_id),
      }
    },
  })
}
