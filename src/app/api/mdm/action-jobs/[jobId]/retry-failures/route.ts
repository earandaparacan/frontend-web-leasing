import { forwardMdmRequest, getMdmActionJobsUrl } from "@/lib/mdm-backend";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  return forwardMdmRequest(
    getMdmActionJobsUrl(jobId, "retry-failures"),
    {},
    30_000,
  );
}
