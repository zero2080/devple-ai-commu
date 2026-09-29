import { useMutation } from '@tanstack/react-query';

import { loginWithAccessKey } from '../session';

export function useLogin() {
  return useMutation({
    mutationFn: (accessKey: string) => loginWithAccessKey(accessKey),
  });
}
