import { Notice } from "@/components/ui/Notice";
import {
  type ApiContractError,
  type ApiError,
  type ApiUnreachableError,
  codeOf,
  sentenceFor,
} from "@/lib/api/errors";

/** What a listing shows in place of itself when the API would not answer. */
export function ApiFailure({
  title,
  error,
}: {
  title: string;
  error: ApiError | ApiUnreachableError | ApiContractError;
}) {
  return (
    <Notice title={title} code={codeOf(error)}>
      {sentenceFor(error)}
    </Notice>
  );
}
