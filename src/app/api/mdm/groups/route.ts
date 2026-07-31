import {
  forwardMdmRequest,
  getMdmGroupsUrl,
} from "@/lib/mdm-backend";

export async function GET() {
  return forwardMdmRequest(getMdmGroupsUrl(), undefined, 30_000, "GET");
}
