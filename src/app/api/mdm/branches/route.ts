import { forwardMdmRequest, getMdmBranchesUrl } from "@/lib/mdm-backend";

export async function GET() {
  return forwardMdmRequest(getMdmBranchesUrl(), undefined, 30_000, "GET");
}
