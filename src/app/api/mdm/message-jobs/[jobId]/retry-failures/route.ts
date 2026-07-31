import { forwardMdmRequest, getMdmMessageJobsUrl } from "@/lib/mdm-backend";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;

  if (!jobId) {
    return Response.json(
      { status: "error", message: "El identificador del envío no es válido." },
      { status: 400 },
    );
  }

  return forwardMdmRequest(
    getMdmMessageJobsUrl(jobId, "retry-failures"),
    undefined,
    30_000,
    "POST",
  );
}
