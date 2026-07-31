import { forwardMdmRequest, getMdmMessageJobsUrl } from "@/lib/mdm-backend";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function validJobId(jobId: string) {
  return jobId.length > 0;
}

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;

  if (!validJobId(jobId)) {
    return Response.json(
      { status: "error", message: "El identificador del envío no es válido." },
      { status: 400 },
    );
  }

  return forwardMdmRequest(getMdmMessageJobsUrl(jobId), undefined, 30_000, "GET");
}
