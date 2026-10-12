import { useEffect, useRef, type FormEvent } from "react";

// `pending` updates after a render, so a synchronous second submit needs a ref.
export function useSubmitGuard(pending: boolean) {
  const submitting = useRef(false);

  useEffect(() => {
    if (!pending) submitting.current = false;
  }, [pending]);

  return (event: FormEvent<HTMLFormElement>) => {
    if (pending || submitting.current) event.preventDefault();
    else submitting.current = true;
  };
}
