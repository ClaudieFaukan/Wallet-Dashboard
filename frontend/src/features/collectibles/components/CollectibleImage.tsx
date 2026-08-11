import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

/** Fetches the item's image through the backend proxy (`GET /collectibles/:id/image`) rather
 * than hotlinking the stored URL directly — many CDNs (e.g. Cardmarket's product-images
 * bucket) reject cross-site Referers, so a plain <img src={imageUrl}> just renders broken. The
 * proxy route requires the Bearer token, which an <img> tag can't send on its own, so the image
 * is fetched here as a blob and turned into an object URL instead.
 *
 * `updatedAt` is sent as a cache-busting query param and used as part of the remount key: the
 * proxy URL is otherwise always `/collectibles/:id/image` regardless of which underlying image
 * URL it resolves, so without it neither the browser HTTP cache nor this component would notice
 * that the stored image URL changed after an edit. */
export function CollectibleImage({
  itemId,
  imageUrl,
  updatedAt,
  alt,
  className,
}: {
  itemId: string;
  imageUrl: string | null;
  updatedAt: string;
  alt: string;
  className?: string;
}) {
  return (
    <CollectibleImageInner
      key={`${itemId}:${imageUrl}:${updatedAt}`}
      itemId={itemId}
      hasImage={Boolean(imageUrl)}
      updatedAt={updatedAt}
      alt={alt}
      className={className}
    />
  );
}

function CollectibleImageInner({
  itemId,
  hasImage,
  updatedAt,
  alt,
  className,
}: {
  itemId: string;
  hasImage: boolean;
  updatedAt: string;
  alt: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasImage) return;

    let cancelled = false;
    let createdUrl: string | null = null;
    api.collectibles
      .imageBlob(itemId, updatedAt)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [itemId, hasImage, updatedAt]);

  if (!hasImage || failed) {
    return <span className="text-xs text-text-muted">Pas d'image</span>;
  }
  if (!objectUrl) {
    return null;
  }
  return <img src={objectUrl} alt={alt} className={className} />;
}
