import { forwardMdmRequest, getMdmCapabilitiesUrl } from "@/lib/mdm-backend";

export async function GET() {
  return forwardMdmRequest(getMdmCapabilitiesUrl(), undefined, 30_000, "GET");
}
