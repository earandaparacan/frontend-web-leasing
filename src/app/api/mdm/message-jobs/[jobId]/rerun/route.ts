import { forwardMdmRequest, getMdmMessageJobsUrl } from "@/lib/mdm-backend";

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  return forwardMdmRequest(
    getMdmMessageJobsUrl(jobId, "rerun"),
    undefined,
    30_000,
    "POST",
  );
}
