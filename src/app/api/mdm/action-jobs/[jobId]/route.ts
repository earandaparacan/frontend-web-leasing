import { forwardMdmRequest, getMdmActionJobsUrl } from "@/lib/mdm-backend";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  return forwardMdmRequest(getMdmActionJobsUrl(jobId), undefined, 30_000, "GET");
}
