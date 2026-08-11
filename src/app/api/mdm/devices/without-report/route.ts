import { forwardMdmRequest, getMdmWithoutReportUrl } from "@/lib/mdm-backend";

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period");
  if (period !== "24h" && period !== "7d") {
    return Response.json(
      { status: "error", message: "El período debe ser 24h o 7d." },
      { status: 400 },
    );
  }

  return forwardMdmRequest(getMdmWithoutReportUrl(period), undefined, 30_000, "GET");
}
