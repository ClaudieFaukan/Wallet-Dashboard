import { useEffect, useState } from 'react';

export function useTouchIdAvailability() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    window.electronApi?.touchId
      .isAvailable()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  return available;
}
