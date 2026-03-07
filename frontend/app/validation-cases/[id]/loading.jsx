import { headers } from "next/headers";
import ValidationCaseRecordSkeleton from "./ValidationCaseRecordSkeleton";
import {
  fetchCasePublic,
  resolveValidationCaseIdFromPathname,
  resolveValidationCaseSkeletonVariant,
} from "./casePublicData";

export default async function ValidationCaseRecordLoading() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") || "";
  const id = resolveValidationCaseIdFromPathname(pathname);

  if (!id) {
    return <ValidationCaseRecordSkeleton variant="generic" />;
  }

  const data = await fetchCasePublic(id);
  const variant = resolveValidationCaseSkeletonVariant(data);

  return <ValidationCaseRecordSkeleton variant={variant} />;
}
